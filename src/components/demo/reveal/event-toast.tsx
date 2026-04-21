'use client';

import type { ActiveToast } from './toast-provider';

/**
 * Single toast card. Presentational only — lifecycle is owned by ToastProvider.
 *
 * Visual treatment per `docs/REQUIREMENTS.md` Phase 9F deliverable 1:
 * warm amber mono on near-black pill, `>` prompt, event name, optional one-line
 * detail, optional routing footer with → arrow and chip set.
 */
export function EventToast({
  toast,
  reducedMotion,
}: {
  toast: ActiveToast;
  reducedMotion: boolean;
}) {
  const position = toast.position ?? 'viewport-top';
  return (
    <div
      data-toast-card=""
      data-position={position}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      role="status"
      className="pointer-events-auto flex max-w-[480px] items-start gap-2 rounded-md border border-[#F3C769]/30 bg-[#0D0B09] px-3 py-2 font-mono text-xs text-[#EAD9BC] shadow-lg"
    >
      <span aria-hidden="true" className="text-[#F3C769]">
        &gt;
      </span>
      <div className="flex flex-col gap-1">
        <div className="text-[#F3C769]">{toast.event_name}</div>
        {toast.detail ? (
          <div data-toast-detail="" className="text-[#EAD9BC]/80">
            {toast.detail}
          </div>
        ) : null}
        {toast.routing && toast.routing.length > 0 ? (
          <div className="flex items-center gap-1 text-[#9E8A6B]">
            <span aria-hidden="true">→</span>
            {toast.routing.map((r, i) => (
              <span
                key={`${r}-${i}`}
                className="rounded border border-[#F3C769]/20 px-1 py-[1px] text-[10px]"
              >
                {r}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
