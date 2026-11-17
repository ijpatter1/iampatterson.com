'use client';

/**
 * Claudish translator — orchestrator for /claudish.
 *
 * Owns input + tab state, runs the detection latch inside the change
 * handler (event-handler setState, no effect-driven detection), wires
 * the translation state machine, rehydrates share links at zero token
 * cost, and fires the page's analytics. Detection fires once per
 * session per language via a sessionStorage gate (nav-hint precedent).
 *
 * Without a share link the page opens on the first stored sample,
 * already translated, and the "Try one" cards show the others (21.3).
 * Samples are stored real output: showing one makes no request and fires
 * no event. A sample picks its own source tab and feeds the detection
 * latch, and an edit keeps that tab (a departure from the mockup, which
 * went back to Detect and could translate Claudish into Claudish).
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useClaudishTranslation } from '@/hooks/useClaudishTranslation';
import { useScrollToTopOnMount } from '@/hooks/useScrollToTopOnMount';
import { createDetectionLatch, warmCcld } from '@/lib/claudish/detect';
import { CLAUDISH_SAMPLES } from '@/lib/claudish/samples';
import { decodeShare } from '@/lib/claudish/share-codec';
import { trackClaudishDetected, trackClaudishShare } from '@/lib/events/track';

import { ClaudishFooter } from './claudish-footer';
import { SamplePhrases } from './sample-phrases';
import { TranslateSurface } from './translate-surface';

import type { ClaudishDirection } from '@/hooks/useClaudishTranslation';
import type { DetectionLatch } from '@/lib/claudish/detect';
import type { LatchState } from '@/lib/claudish/types';

const ANALYTICS_DIRECTION = {
  en2cl: 'en_to_claudish',
  cl2en: 'claudish_to_en',
} as const;

const NEUTRAL_LATCH: LatchState = {
  detected: false,
  lang: 'unknown',
  tier: 'leaning',
  confidence: 0.5,
  source: 'heuristic',
};

/**
 * Once-per-session-per-language gate. sessionStorage is the durable gate;
 * when storage throws (Safari ITP, cookies-blocked), the caller's
 * per-mount Set is the fallback so the event fires at most once per
 * mount instead of once per keystroke.
 */
function detectedGateHolds(lang: string, firedThisMount: Set<string>): boolean {
  if (firedThisMount.has(lang)) return true;
  firedThisMount.add(lang);
  const key = `iap_claudish_detected_${lang}`;
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  } catch {
    return false;
  }
}

export function ClaudishApp({ shareParam }: { shareParam?: string }) {
  useScrollToTopOnMount();
  const share = useMemo(
    () => (shareParam ? decodeShare(shareParam) : null),
    [shareParam]
  );

  // A share link opens on the shared text, and one that fails to decode
  // opens the translator empty (20.3), never on a sample posing as the
  // shared translation. Without a share link the page opens on sample 1.
  const opening = shareParam ? share : CLAUDISH_SAMPLES[0];
  // Which sample the panels show; null once the text is the visitor's own.
  const [activeSample, setActiveSample] = useState<number | null>(shareParam ? null : 0);

  const [input, setInput] = useState(opening?.source ?? '');
  // 0 = Detect language (auto), 1 = English, 2 = Claudish.
  const [sourceTab, setSourceTab] = useState(
    opening ? (opening.direction === 'cl2en' ? 2 : 1) : 0
  );
  const latchRef = useRef<DetectionLatch | null>(null);
  // The opening sample feeds the latch like a tapped one (no event fires).
  // Computed on the first render only, which is the only one useState reads.
  let openingLatch = NEUTRAL_LATCH;
  if (latchRef.current == null) {
    const detector = createDetectionLatch();
    if (!shareParam) openingLatch = detector.update(CLAUDISH_SAMPLES[0].source);
    latchRef.current = detector;
  }
  const [latch, setLatch] = useState<LatchState>(openingLatch);
  const detectedFiredRef = useRef<Set<string> | null>(null);
  if (detectedFiredRef.current == null) detectedFiredRef.current = new Set();

  useEffect(() => {
    void warmCcld(); // fire-and-forget: heuristic answers until this lands
  }, []);

  // Belt-and-braces twin of the layout's parse-time strip: the layout
  // script covers hard loads; this covers any future client-side
  // navigation into /claudish?t=... (none exists today). Idempotent.
  useEffect(() => {
    if (!shareParam) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('t')) {
        url.searchParams.delete('t');
        const query = url.searchParams.toString();
        window.history.replaceState(
          window.history.state,
          '',
          `${url.pathname}${query ? `?${query}` : ''}${url.hash}`
        );
      }
    } catch {
      // URL/history unavailable: nothing to strip.
    }
  }, [shareParam]);

  // A share open is a distribution event — exactly once, even under
  // StrictMode's double-invoked effects.
  const shareOpenFiredRef = useRef(false);
  useEffect(() => {
    if (!share || shareOpenFiredRef.current) return;
    shareOpenFiredRef.current = true;
    trackClaudishShare({
      share_action: 'opened_shared_link',
      direction: ANALYTICS_DIRECTION[share.direction],
      output_chars: share.target.length,
      share_truncated: share.excerpt,
      share_url_chars: shareParam?.length ?? 0,
    });
  }, [share, shareParam]);

  // The claimed side drives the auto direction (no hedging): a tab that
  // says "Leaning Claudish" must translate INTO English, latched or not.
  const claimedClaudish = latch.lang === 'en-x-claudish';
  const directionFor = (tab: number): ClaudishDirection =>
    tab === 0 ? (claimedClaudish ? 'cl2en' : 'en2cl') : tab === 2 ? 'cl2en' : 'en2cl';
  const direction = directionFor(sourceTab);

  const translation = useClaudishTranslation({
    input,
    direction,
    // An empty target (tier-6 source-only shares) seeds the INPUT only:
    // the normal debounce then translates it fresh, instead of presenting
    // a permanently blank 'done' panel. The opening sample always has one.
    initialResolved: opening?.target
      ? { input: opening.source, direction: opening.direction, text: opening.target }
      : undefined,
  });

  const handleSamplePick = (index: number) => {
    const sample = CLAUDISH_SAMPLES[index];
    setInput(sample.source);
    setSourceTab(sample.direction === 'cl2en' ? 2 : 1);
    setActiveSample(index);
    // Feed the latch the sample's text, as swap does with its output, so
    // Detect claims the right side later. No claudish_detected fires: the
    // visitor typed nothing.
    setLatch(latchRef.current!.update(sample.source));
    translation.showStored({
      input: sample.source,
      direction: sample.direction,
      text: sample.target,
    });
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (activeSample !== null) {
      // The visitor's own text now. The sample's tab stays (it named the
      // side); clearing the example outright hands the box back to Detect.
      setActiveSample(null);
      if (value.trim().length === 0) setSourceTab(0);
    }
    if (value.trim().length === 0) {
      // An emptied textarea is a fresh start: a held latch would misroute
      // the NEXT input's auto direction (stale cl2en over new English).
      latchRef.current!.reset();
      setLatch(NEUTRAL_LATCH);
      return;
    }
    const next = latchRef.current!.update(value);
    setLatch(next);
    if (next.lang !== 'unknown' && !detectedGateHolds(next.lang, detectedFiredRef.current!)) {
      trackClaudishDetected({
        detected_language: next.lang,
        detector_source: next.source,
        input_chars: value.length,
      });
    }
  };

  const handleSwap = () => {
    const output = translation.status === 'done' ? translation.text : '';
    const nextDirection: ClaudishDirection = direction === 'en2cl' ? 'cl2en' : 'en2cl';
    setSourceTab(nextDirection === 'cl2en' ? 2 : 1);
    setActiveSample(null);
    if (output) {
      setInput(output);
      setLatch(latchRef.current!.update(output));
      translation.translateNow({ input: output, direction: nextDirection });
    }
  };

  // What the Detect tab claims. No hedging (user decision): once input
  // is readable the tab always names a side — English / Leaning English /
  // Leaning Claudish / Claudish - detected. "Detect language" survives
  // only for an empty or sub-24-char box.
  const detection =
    sourceTab !== 0 || input.trim().length === 0 || latch.lang === 'unknown'
      ? null
      : { lang: latch.lang, tier: latch.tier };

  // Target row: 0 = English, 1 = Claudish; choosing one determines direction.
  const targetTab = direction === 'en2cl' ? 1 : 0;
  // The input (and so the key) is unchanged by a tab click: only a
  // direction change replaces the stored sample with a live translation.
  const handleSourceSelect = (index: number) => {
    if (directionFor(index) !== direction) setActiveSample(null);
    setSourceTab(index);
  };
  const handleTargetSelect = (index: number) => {
    handleSourceSelect(index === 0 ? 2 : 1);
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 md:px-6">
      <h1 className="text-xl text-[var(--gt-text,#202124)]">Claudish Translate</h1>
      <TranslateSurface
        sourceProps={{
          value: input,
          onChange: handleInputChange,
          activeTab: sourceTab,
          onTabSelect: handleSourceSelect,
          detection,
        }}
        targetProps={{
          source: input,
          direction,
          status: translation.status,
          text: translation.text,
          staleText: translation.staleText,
          hasFirstToken: translation.hasFirstToken,
          ttftMs: translation.ttftMs,
          cache: translation.cache,
          activeTab: targetTab,
          onTabSelect: handleTargetSelect,
        }}
        onSwap={handleSwap}
      />
      <SamplePhrases
        samples={CLAUDISH_SAMPLES}
        activeIndex={activeSample}
        onPick={handleSamplePick}
      />
      <ClaudishFooter />
    </main>
  );
}
