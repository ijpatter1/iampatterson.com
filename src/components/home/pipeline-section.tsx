'use client';

import { useEffect, useState } from 'react';

import { useLiveEvents } from '@/hooks/useLiveEvents';
import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

const STAGES = [
  { n: '01', title: 'Browser', detail: 'dataLayer.push' },
  { n: '02', title: 'Client GTM', detail: 'consent check' },
  { n: '03', title: 'sGTM', detail: 'event processing' },
  { n: '04', title: 'BigQuery', detail: 'warehouse write' },
  { n: '05', title: 'Dashboards', detail: 'Metabase' },
];

export function PipelineSection() {
  const [activeStage, setActiveStage] = useState(0);
  const { open } = useOverlay();
  const { events } = useLiveEvents();

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setActiveStage((s) => (s + 1) % STAGES.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  const logRows = events.slice(0, 5);

  const handleOpen = () => {
    trackClickCta('Watch it live', 'pipeline_watch_it_live');
    open();
  };

  return (
    <section
      data-testid="pipeline-section"
      className="border-t border-rule-soft bg-paper py-20 md:py-28"
    >
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-end md:gap-20">
          <h2
            className="font-display font-normal text-ink"
            style={{
              fontSize: 'clamp(40px, 7vw, 96px)',
              lineHeight: '0.95',
              letterSpacing: '-0.02em',
            }}
          >
            Your session is
            <br />
            being <em className="text-accent-current">measured</em>
            <br />
            right now.
          </h2>
          <p className="max-w-[42ch] text-base leading-[1.7] text-ink-2 md:pb-3">
            Every scroll, click, and page view on this site flows through the same measurement
            pipeline I deploy for clients.
            <br />
            <br />
            The events aren&apos;t simulated. The warehouse is real. The dashboards are running.
          </p>
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-6">
            {STAGES.map((s, i) => {
              const active = activeStage === i;
              return (
                <div
                  key={s.n}
                  data-testid={`pipeline-stage-${s.n}`}
                  data-active={active}
                  className={`flex flex-col items-start gap-2 rounded-sm border px-4 py-5 transition-all ${
                    active
                      ? 'border-accent-current bg-paper shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_10%,transparent)]'
                      : 'border-rule-soft bg-paper'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] tracking-wide transition-colors ${
                      active ? 'bg-accent-current text-paper' : 'bg-paper-alt text-ink-3'
                    }`}
                  >
                    {s.n}
                  </span>
                  <span className="font-display text-lg text-ink">{s.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                    {s.detail}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="mt-8 overflow-hidden rounded-sm border border-rule-soft bg-paper-alt"
            data-testid="pipeline-log-feed"
          >
            <div className="border-b border-rule-soft bg-paper px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-3">
              Live event stream
            </div>
            <div className="max-h-48 overflow-hidden px-4 py-3">
              {logRows.length === 0 ? (
                <p className="font-mono text-xs text-ink-3">
                  Waiting for events… interact with the page to start the stream.
                </p>
              ) : (
                <ul className="space-y-1">
                  {logRows.map((e) => (
                    <li
                      key={e.pipeline_id}
                      className="flex items-baseline gap-3 font-mono text-[11px] text-ink-2"
                    >
                      <span className="text-ink-4">{formatTime(e.timestamp)}</span>
                      <span className="text-accent-current">{e.event_name}</span>
                      <span className="text-ink-3 truncate">{e.page_path}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-2 rounded-full border border-rule-soft bg-paper px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-2 transition-all hover:border-ink hover:bg-ink hover:text-paper"
          >
            <span aria-hidden="true">↻</span>
            Watch it live
          </button>
        </div>
      </div>
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch {
    return '--:--:--';
  }
}
