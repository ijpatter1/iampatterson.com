'use client';

/**
 * Claudish translator — translate-as-you-type state machine.
 *
 * The latency choreography the spoof lives or dies on: ~600ms debounce,
 * abort-on-edit (AbortController end to end — the client shell cancels
 * the reader so the proxy stops paying for tokens), stale output dimmed
 * until the first new token lands, refusal discarding partial AND stale,
 * capacity/error collapsing to the verbatim boundary line, a bounded
 * client LRU short-circuiting repeats, and a missing proxy URL degrading
 * to capacity so previews never render a broken state.
 *
 * Architecture note: status is DERIVED at render time from the reducer
 * phase plus whether the current input key matches the resolved key —
 * typing flips the derived status to 'debouncing' with no setState in
 * any effect body (the repo enforces react-hooks/set-state-in-effect).
 * All dispatches happen inside timer and stream callbacks. A monotonic
 * seq guards against frames landing between abort() and reader close,
 * the same race useEventStream documents.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { streamTranslation, translateEndpoint } from '@/lib/claudish/client';
import { detectClaudish } from '@/lib/claudish/detect';
import { CLIENT_CACHE_MAX_ENTRIES, DEBOUNCE_MS } from '@/lib/claudish/limits';
import { normalizeTranslationInput } from '@/lib/claudish/normalize';
import { countEmDashes } from '@/lib/claudish/text-stats';
import { trackClaudishTranslate } from '@/lib/events/track';

import type { ClaudishFrame } from '@/lib/claudish/sse';

export type ClaudishDirection = 'en2cl' | 'cl2en';

export type TranslationStatus =
  | 'idle'
  | 'debouncing'
  | 'streaming'
  | 'done'
  | 'refused'
  | 'capacity'
  | 'error';

export interface ClaudishTranslationState {
  status: TranslationStatus;
  /** Live/final output for the current input. */
  text: string;
  /** Previous output, rendered dimmed until the first new token. */
  staleText: string;
  hasFirstToken: boolean;
  ttftMs: number | null;
  cache: 'miss' | 'client' | 'server';
}

interface Options {
  input: string;
  direction: ClaudishDirection;
  /** Defaults to NEXT_PUBLIC_CLAUDISH_PROXY_URL; undefined ⇒ capacity mode. */
  proxyUrl?: string;
  debounceMs?: number;
  /**
   * Share-link rehydration seed: presents as an already-done translation
   * and pre-warms the client cache, so opening a shared link costs zero
   * tokens no matter how viral it goes. Fires no analytics (the share
   * open is its own event, owned by the caller).
   */
  initialResolved?: { input: string; direction: ClaudishDirection; text: string };
}

type Phase = 'resting' | 'streaming' | 'done' | 'refused' | 'capacity' | 'error';

interface MachineState {
  phase: Phase;
  /** The `direction::normalized` key the phase refers to. */
  key: string | null;
  text: string;
  stale: string;
  hasFirstToken: boolean;
  ttftMs: number | null;
  cache: 'miss' | 'client' | 'server';
}

type Action =
  | { type: 'stream-start'; key: string }
  | { type: 'token'; t: string; ttftMs: number | null }
  | { type: 'done' }
  | { type: 'refusal' }
  | { type: 'capacity' }
  | { type: 'error' }
  | { type: 'server-cache' }
  | { type: 'cache-hit'; key: string; text: string }
  | { type: 'revise' };

const INITIAL: MachineState = {
  phase: 'resting',
  key: null,
  text: '',
  stale: '',
  hasFirstToken: false,
  ttftMs: null,
  cache: 'miss',
};

function reducer(state: MachineState, action: Action): MachineState {
  switch (action.type) {
    case 'stream-start':
      return {
        phase: 'streaming',
        key: action.key,
        text: '',
        // The last visible output survives, dimmed, until a new token lands.
        stale: state.text || state.stale,
        hasFirstToken: false,
        ttftMs: null,
        cache: 'miss',
      };
    case 'token':
      return {
        ...state,
        text: state.text + action.t,
        stale: state.hasFirstToken ? state.stale : '',
        hasFirstToken: true,
        ttftMs: state.hasFirstToken ? state.ttftMs : action.ttftMs,
      };
    case 'revise':
      // The loop found a meaningfully better translation: clear the
      // panel and let the replacement stream in (Google Translate
      // refines visibly too — in-genre).
      return { ...state, text: '' };
    case 'server-cache':
      return { ...state, cache: 'server' };
    case 'done':
      return { ...state, phase: 'done' };
    case 'refusal':
      // Spec: discard any partial output; a refusal beside an unrelated
      // stale translation reads as a bug, so both clear.
      return { ...state, phase: 'refused', text: '', stale: '', hasFirstToken: false };
    case 'capacity':
      return { ...state, phase: 'capacity', text: '', hasFirstToken: false };
    case 'error':
      return { ...state, phase: 'error', text: '', hasFirstToken: false };
    case 'cache-hit':
      return {
        phase: 'done',
        key: action.key,
        text: action.text,
        stale: '',
        hasFirstToken: true,
        ttftMs: 0,
        cache: 'client',
      };
    default:
      return state;
  }
}

const ANALYTICS_DIRECTION = {
  en2cl: 'en_to_claudish',
  cl2en: 'claudish_to_en',
} as const;

export function useClaudishTranslation(options: Options): ClaudishTranslationState & {
  /** Immediate manual translation; override lets swap fire before state settles. */
  translateNow: (override?: { input: string; direction: ClaudishDirection }) => void;
} {
  const {
    input,
    direction,
    proxyUrl = process.env.NEXT_PUBLIC_CLAUDISH_PROXY_URL,
    debounceMs = DEBOUNCE_MS,
  } = options;
  // Bare service URL or full endpoint, both reach /translate.
  const endpoint = proxyUrl ? translateEndpoint(proxyUrl) : undefined;

  const [state, dispatch] = useReducer(
    reducer,
    options.initialResolved,
    (seed): MachineState =>
      seed
        ? {
            phase: 'done',
            key: `${seed.direction}::${normalizeTranslationInput(seed.input)}`,
            text: seed.text,
            stale: '',
            hasFirstToken: true,
            ttftMs: 0,
            cache: 'client',
          }
        : INITIAL
  );

  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  // Refusals are terminal by design: re-sending a refused input re-refuses
  // and burns tokens for nothing, so the VERDICT is remembered per key
  // (never the content — the cache stays refusal-free per spec).
  const refusedKeysRef = useRef<Set<string>>(new Set());
  // Lazy-initialized (house `== null` pattern) so the share-rehydration
  // seed lands in the cache exactly once, on first render.
  const cacheRef = useRef<Map<string, string> | null>(null);
  if (cacheRef.current == null) {
    const seeded = new Map<string, string>();
    const seed = options.initialResolved;
    if (seed && seed.text.length > 0) {
      seeded.set(
        `${seed.direction}::${normalizeTranslationInput(seed.input)}`,
        seed.text
      );
    }
    cacheRef.current = seeded;
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualRef = useRef(false);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const normalized = normalizeTranslationInput(input);
  const key = normalized ? `${direction}::${normalized}` : null;

  const startTranslation = useCallback(
    (runKey: string, runText: string, runDirection: ClaudishDirection) => {
      const seq = ++seqRef.current;
      // Any new translation intent supersedes whatever is streaming — incl.
      // the short-circuit paths (cache hit, remembered refusal, no-proxy),
      // which return before a controller exists: without this, a manual
      // fire to a cached key would leave a different key's stream burning
      // to completion (re-check finding, round 2).
      abortRef.current?.abort();
      abortRef.current = null;
      const sourceMode = manualRef.current ? 'manual' : 'auto';
      manualRef.current = false;

      const detection = detectClaudish(runText);
      const baseEventFields = {
        direction: ANALYTICS_DIRECTION[runDirection],
        source_mode: sourceMode as 'auto' | 'manual',
        detected_language:
          detection.lang === 'unknown' ? ('none' as const) : detection.lang,
        detector_source: detection.source,
        input_chars: runText.length,
        input_em_dashes: countEmDashes(runText),
      };

      // A remembered refusal short-circuits without a request or analytics:
      // it is a replayed verdict, not a new translation.
      if (refusedKeysRef.current.has(runKey)) {
        dispatch({ type: 'stream-start', key: runKey });
        dispatch({ type: 'refusal' });
        return;
      }

      // Client cache short-circuit: instant done, zero network.
      const cached = cacheRef.current?.get(runKey);
      if (cached !== undefined) {
        // Refresh LRU recency.
        cacheRef.current?.delete(runKey);
        cacheRef.current?.set(runKey, cached);
        dispatch({ type: 'cache-hit', key: runKey, text: cached });
        trackClaudishTranslate({
          ...baseEventFields,
          outcome: 'complete',
          output_chars: cached.length,
          ttft_ms: 0,
          duration_ms: 0,
          cache: 'client',
        });
        return;
      }

      if (!endpoint) {
        // No proxy configured (preview deploys, local dev without env):
        // the page never shows a broken state — capacity mode.
        dispatch({ type: 'stream-start', key: runKey });
        dispatch({ type: 'capacity' });
        trackClaudishTranslate({
          ...baseEventFields,
          outcome: 'capacity',
          output_chars: 0,
          ttft_ms: 0,
          duration_ms: 0,
          cache: 'miss',
        });
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: 'stream-start', key: runKey });

      const t0 = performance.now();
      let accumulated = '';
      let serverCache = false;
      let terminal: 'complete' | 'refused' | 'capacity' | 'error' | null = null;
      let ttft = 0;

      const finish = (outcome: 'complete' | 'refused' | 'capacity' | 'error') => {
        trackClaudishTranslate({
          ...baseEventFields,
          outcome,
          output_chars: outcome === 'complete' ? accumulated.length : 0,
          ttft_ms: outcome === 'complete' ? Math.round(ttft) : 0,
          duration_ms: Math.round(performance.now() - t0),
          cache: serverCache ? 'server' : 'miss',
        });
      };

      const onFrame = (frame: ClaudishFrame) => {
        if (seq !== seqRef.current || controller.signal.aborted) return;
        switch (frame.type) {
          case 'meta':
            if (frame.cached) {
              serverCache = true;
              dispatch({ type: 'server-cache' });
            }
            break;
          case 'revise':
            accumulated = '';
            dispatch({ type: 'revise' });
            break;
          case 'token': {
            const first = accumulated.length === 0;
            if (first) ttft = performance.now() - t0;
            accumulated += frame.t;
            dispatch({ type: 'token', t: frame.t, ttftMs: first ? Math.round(ttft) : null });
            break;
          }
          case 'done':
            terminal = 'complete';
            dispatch({ type: 'done' });
            const cache = cacheRef.current;
            if (cache) {
              cache.set(runKey, accumulated);
              if (cache.size > CLIENT_CACHE_MAX_ENTRIES) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) cache.delete(oldest);
              }
            }
            finish('complete');
            break;
          case 'refusal':
            terminal = 'refused';
            refusedKeysRef.current.add(runKey);
            dispatch({ type: 'refusal' });
            finish('refused');
            break;
          case 'capacity':
            terminal = 'capacity';
            dispatch({ type: 'capacity' });
            finish('capacity');
            break;
          case 'error':
            terminal = 'error';
            dispatch({ type: 'error' });
            finish('error');
            break;
        }
      };

      void streamTranslation(
        endpoint,
        { text: runText, direction: runDirection },
        controller.signal,
        onFrame
      ).then((result) => {
        if (seq !== seqRef.current || terminal !== null) return;
        if (result.kind === 'aborted') return; // an abort is a keystroke, not an error
        if (controller.signal.aborted) return;
        if (result.kind === 'http' && (result.status === 429 || result.status === 503)) {
          dispatch({ type: 'capacity' });
          finish('capacity');
          return;
        }
        // Everything else — other HTTP codes, network drops, streams that
        // ended without a terminal frame — is a generic error (rendered as
        // the capacity line by decision; the real cause lives in analytics).
        dispatch({ type: 'error' });
        finish('error');
      });
    },
    [endpoint]
  );

  // Debounce + abort-on-edit. The skip decisions run BEFORE any abort or
  // seq bump (CR5): a swap's translateNow starts a stream for exactly the
  // key this effect then sees — aborting it (or even bumping seq, which
  // silently orphans its frames) would kill the manual request and re-fire
  // it 600ms later as 'auto'. Liveness is judged from the reducer state
  // (phase streaming + key match), never from abortRef — a completed
  // stream leaves an un-aborted controller behind (CR5 refuter finding).
  useEffect(() => {
    const runKey = normalized ? `${direction}::${normalized}` : null;
    const resolved = stateRef.current;
    if (runKey !== null && runKey === resolved.key) {
      // Liveness needs BOTH signals: the reducer phase alone over-reports
      // after an abort (nothing dispatches on abort — edit away and back
      // within the debounce would strand a stale 'streaming'), and the
      // controller alone under-reports after completion. Together they
      // are exact (re-check finding, round 2).
      const genuinelyLive =
        resolved.phase === 'streaming' &&
        abortRef.current !== null &&
        !abortRef.current.signal.aborted;
      if (genuinelyLive) {
        return undefined; // that exact stream is in flight: leave it be
      }
      if (resolved.phase === 'streaming') {
        // Stale streaming phase from an aborted run: fall through and re-arm.
      } else
      if (resolved.phase === 'done' || resolved.phase === 'refused') {
        return undefined; // terminal for this input — done serves from state, refusals stay refused
      }
      // error/capacity fall through: transient failures are retryable (CR7).
    }
    abortRef.current?.abort();
    abortRef.current = null;
    seqRef.current++;
    if (runKey === null) return undefined;
    const timer = setTimeout(() => {
      startTranslation(runKey, normalized, direction);
    }, debounceMs);
    timerRef.current = timer;
    return () => clearTimeout(timer);
  }, [normalized, direction, debounceMs, startTranslation]);

  // Unmount: kill the stream so the proxy sees the close.
  useEffect(
    () => () => {
      seqRef.current++;
      abortRef.current?.abort();
    },
    []
  );

  const translateNow = useCallback(
    (override?: { input: string; direction: ClaudishDirection }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      manualRef.current = true;
      const runDirection = override?.direction ?? direction;
      const now = normalizeTranslationInput(override?.input ?? input);
      if (!now) return;
      startTranslation(`${runDirection}::${now}`, now, runDirection);
    },
    [input, direction, startTranslation]
  );

  // Derived presentation state.
  let status: TranslationStatus;
  const current = key !== null && state.key === key;
  if (!key) {
    status = 'idle';
  } else if (current) {
    status =
      state.phase === 'resting'
        ? 'debouncing'
        : (state.phase as Exclude<Phase, 'resting'>);
  } else {
    status = 'debouncing';
  }

  const text = current ? state.text : '';
  const showStale =
    status === 'debouncing' || (status === 'streaming' && !state.hasFirstToken);
  // For a non-current key, whatever was last visible (a finished
  // translation, or the partial of an aborted stream) is the stale text.
  const staleText = !showStale ? '' : current ? state.stale : state.text || state.stale;

  return {
    status,
    text,
    staleText,
    hasFirstToken: current && state.hasFirstToken,
    ttftMs: current ? state.ttftMs : null,
    cache: current ? state.cache : 'miss',
    translateNow,
  };
}
