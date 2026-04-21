'use client';

import { useEffect, useRef, useState } from 'react';

import { useLiveEvents } from '@/hooks/useLiveEvents';
import { getSessionId } from '@/lib/events/session';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/content/pipeline';

const STAGE_ROTATION_MS = 1800;
const FEED_VISIBLE_ROWS = 4;
const SESSION_FEED_BUFFER = 12;

interface FootnoteRow {
  id: string;
  ts: string;
  evt: string;
  pay: string;
}

const SEED_ROWS: FootnoteRow[] = [
  { id: 'seed-0', ts: '00:00.00', evt: 'session_start', pay: 'source=direct medium=none' },
  { id: 'seed-1', ts: '00:00.18', evt: 'consent_update', pay: 'analytics=granted ad=denied' },
  { id: 'seed-2', ts: '00:00.32', evt: 'page_view', pay: 'path=/ title="iampatterson.com"' },
];

function fmtRelTime(deltaMs: number): string {
  const safe = Math.max(0, deltaMs);
  const s = Math.floor(safe / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const cs = String(Math.floor((safe % 1000) / 10)).padStart(2, '0');
  return `${mm}:${ss}.${cs}`;
}

function formatPayload(
  pagePath: string,
  params: Record<string, string | number | boolean>,
): string {
  const paramStr = Object.entries(params)
    .slice(0, 2)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return paramStr ? `path=${pagePath} ${paramStr}` : `path=${pagePath}`;
}

/**
 * The editorial schematic, five numbered stages on a hairline rail with
 * inline tech callouts and a per-session footnote feed below. The active
 * stage rotates on a 1800ms interval (disabled under prefers-reduced-motion);
 * the footnote feed is seeded with three "already happened" events and then
 * appended live events from `useLiveEvents` as the visitor interacts.
 *
 * Reference: docs/input_artifacts/design_handoff_pipeline/app/PipelineEditorial.jsx
 */
export function PipelineEditorial() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string>('');
  const { events } = useLiveEvents();
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % PIPELINE_STAGES.length);
    }, STAGE_ROTATION_MS);
    return () => window.clearInterval(id);
  }, []);

  const t0 = startedAtRef.current;

  // `useLiveEvents` returns events newest-first. We want the visible window
  // to track the most recent activity, with seeds anchoring the start of
  // session. Reverse the live slice to chronological order (slice already
  // returns a fresh array so the in-place reverse is safe), prepend seeds,
  // then take the trailing FEED_VISIBLE_ROWS so newer events push older
  // ones out as the session progresses. Each row carries its OWN
  // event-time-relative timestamp (Date.parse(e.timestamp) - t0), using
  // Date.now() here would re-stamp every row to the current render tick,
  // making all live rows display the same value and tick forward in
  // lockstep on every re-render. Corrupt timestamps fall back to delta=0
  // (rendering as `00:00.00`) rather than being filtered out, the demo's
  // purpose is to show data flowing through the pipeline, so dropping a
  // row silently would be a worse signal than rendering it with a
  // placeholder timestamp.
  const liveRows: FootnoteRow[] = events
    .slice(0, SESSION_FEED_BUFFER)
    .reverse()
    .map((e) => {
      const eventTime = Date.parse(e.timestamp);
      const delta = Number.isFinite(eventTime) ? eventTime - t0 : 0;
      return {
        id: e.pipeline_id,
        ts: fmtRelTime(delta),
        evt: e.event_name,
        pay: formatPayload(e.page_path, e.parameters),
      };
    });
  const allRows = [...SEED_ROWS, ...liveRows];
  const visibleRows = allRows.slice(-FEED_VISIBLE_ROWS);

  // Match SessionPulse's last-6-char convention so the footer ID matches
  // what the visitor sees in the header chrome, "your session" reads as
  // the same session across both surfaces.
  const sessionShort = sessionId ? `ses_${sessionId.slice(-6)}` : 'ses_······';

  return (
    <div data-testid="pipeline-editorial" className="pv pv-edit relative">
      <div className="pv-edit__title-row mb-6 flex items-baseline gap-3.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">Fig. 01</span>
        <span
          className="font-display italic text-ink-2"
          style={{ fontSize: 'clamp(16px, 2.4vw, 22px)', lineHeight: 1.2 }}
        >
          Event flow · browser&nbsp;→&nbsp;dashboard
        </span>
        <span className="hidden h-px flex-1 bg-rule-soft md:block" aria-hidden="true" />
      </div>

      <ol className="pv-edit__stages list-none border-t border-ink pt-6">
        {PIPELINE_STAGES.map((stage, i) => (
          <PipelineEditorialStage
            key={stage.key}
            stage={stage}
            active={activeIndex === i}
            isLast={i === PIPELINE_STAGES.length - 1}
          />
        ))}
      </ol>

      {/* F6 follow-up, footnote feed hidden on mobile. The 4-row mono
          log at text-[11px] reads cramped on 360px and duplicates the
          "live events" signal already surfaced by SessionPulse's event
          counter in the header. Desktop keeps the secondary live
          signal below the schematic. */}
      <div className="pv-edit__footnote hidden mt-7 border-t border-ink pt-4 md:block">
        <div className="pv-edit__fn-head mb-2 flex items-baseline justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
            Footnote · your session
          </span>
          <span
            data-testid="pipeline-footnote-session"
            className="font-mono text-[11px] text-ink-4"
          >
            {sessionShort}
          </span>
        </div>
        <ul
          data-testid="pipeline-log-feed"
          className="pv-edit__fn-list grid gap-1 font-mono text-[11px] text-ink-2"
        >
          {visibleRows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[64px_1fr] gap-3 border-b border-dashed border-rule-faint py-1 md:grid-cols-[80px_180px_1fr]"
            >
              <span className="t text-ink-4">{row.ts}</span>
              <span className="e col-start-2 text-accent-current">{row.evt}</span>
              <span className="p col-start-2 truncate text-ink-3 md:col-start-3">{row.pay}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PipelineEditorialStage({
  stage,
  active,
  isLast,
}: {
  stage: PipelineStage;
  active: boolean;
  isLast: boolean;
}) {
  return (
    <li
      data-testid={`pipeline-stage-${stage.n}`}
      data-active={active}
      data-key={stage.key}
      className={`pv-edit__stage relative grid grid-cols-[40px_1fr] gap-x-4 border-b border-rule-soft py-3 transition-[background] duration-300 md:grid-cols-[64px_1fr] md:gap-x-7 md:py-6 lg:grid-cols-[84px_1fr] ${
        active ? 'is-hot' : ''
      }`}
    >
      <div
        aria-hidden="true"
        className={`pv-edit__num font-display italic leading-none tracking-[-0.02em] ${
          active ? 'text-accent-current' : 'text-ink'
        }`}
        style={{ fontSize: 'clamp(30px, 4vw, 48px)' }}
      >
        {stage.n}
      </div>
      {/* F6 UAT close-out: the dense instrument-panel columns (tech id,
          sub-caps line, is-hot-gated readouts) are gone. Each stage is
          now just role + title + editorial detail, no dl readout block,
          no max-height animation, no layout shift when the active stage
          rotates. Killing the readout jitter + metadata clipping +
          instrument/editorial clash in one cut (UAT S11 readout-jitter,
          S4 k/v clipping, S4 editorial clash). */}
      <div className="pv-edit__body flex min-w-0 flex-col gap-1 md:gap-1.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
          {stage.role}
        </div>
        <h3
          className="pv-edit__stage-title font-display font-normal leading-[1.02] tracking-[-0.02em] text-ink"
          style={{ fontSize: 'clamp(20px, 3vw, 30px)' }}
        >
          {stage.title}
        </h3>
        <p className="pv-edit__detail mt-0.5 max-w-[60ch] text-[14px] leading-[1.5] text-ink-2 md:mt-1 md:text-[15px] md:leading-[1.55]">
          {renderDetailLine(stage.detail)}
        </p>
      </div>
      {!isLast && (
        <div
          aria-hidden="true"
          className="pv-edit__arrow absolute bottom-[-11px] left-[14px] grid h-5 w-5 place-items-center bg-paper text-sm leading-none text-ink-4 md:left-9"
        >
          ↓
        </div>
      )}
    </li>
  );
}

/**
 * Split a detail line by backtick-quoted mono tokens and render each
 * mono fragment inside an inline `<code>` with the editorial mono
 * treatment. Lets the copy write `iampatterson_raw.events_raw` naturally
 * inside prose while the code substring still renders as code. No HTML
 * interpolation, plain React string children only.
 */
function renderDetailLine(detail: string): React.ReactNode {
  const parts = detail.split(/(`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="font-mono text-[13px] text-ink"
          style={{ wordBreak: 'break-word' }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
