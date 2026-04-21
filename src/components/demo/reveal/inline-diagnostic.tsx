'use client';

import type { ReactNode } from 'react';

/**
 * Pattern 3, Inline diagnostic (Phase 9F deliverable 3).
 *
 * A styled wrapper that applies the terminal token set (dark background,
 * amber headers, warm cream body, scanline texture) and composes arbitrary
 * children. Primary consumers: deliverable 8 checkout warehouse-write sidebar
 * caller, deliverable 9 confirmation-page Metabase-embed payoff. Callers
 * own content shape; this component owns the chrome.
 */
export function InlineDiagnostic({
  tag,
  title,
  className = '',
  children,
}: {
  tag?: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-inline-diagnostic=""
      className={`relative overflow-hidden rounded border border-[#F3C769]/20 bg-[#0D0B09] font-mono text-xs text-[#EAD9BC] ${className}`}
    >
      <div
        data-id-scanlines=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgba(243,199,105,0.04)_2px,rgba(243,199,105,0.04)_3px)]"
      />
      <div className="relative z-10 flex flex-col gap-4 p-6">
        {tag ? (
          <div data-id-tag="" className="text-[10px] uppercase tracking-[0.18em] text-[#F3C769]">
            {tag}
          </div>
        ) : null}
        {title ? (
          <h3 data-id-title="" className="font-display text-2xl leading-tight text-[#EAD9BC]">
            {title}
          </h3>
        ) : null}
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </section>
  );
}
