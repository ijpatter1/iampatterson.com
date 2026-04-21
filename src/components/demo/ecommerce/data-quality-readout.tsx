'use client';

import { assertionsForCart } from '@/lib/demo/reveal/data-quality';

/**
 * Data-quality Tier 2 readout — children of `LiveSidebar` on the cart page.
 * Renders the 6 Dataform assertions as an `[OK]` / `[FAIL]` checklist with
 * one-line detail per row, preceded by a `source: raw.events · streaming`
 * header and a 6-cell pipeline-health meter.
 */
export function DataQualityReadout({
  itemCount,
  uniqueItems,
}: {
  itemCount: number;
  uniqueItems: number;
}) {
  const assertions = assertionsForCart({ itemCount, uniqueItems });
  const passing = assertions.filter((a) => a.status === 'OK').length;

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between text-[11px]">
        <span className="text-[#9E8A6B]">source</span>
        <span className="font-mono text-[#EAD9BC]">raw.events · streaming</span>
      </header>

      <section className="flex flex-col gap-1.5 border-y border-[#F3C769]/15 py-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#EAD9BC]">pipeline health</span>
          <span className="font-mono text-[#F3C769]">
            {passing} / {assertions.length} passing
          </span>
        </div>
        <div className="flex gap-1">
          {assertions.map((a, i) => (
            <div
              key={i}
              data-status={a.status}
              className={`h-2 flex-1 rounded-sm ${
                a.status === 'OK' ? 'bg-[#8FBF7A]' : 'bg-[#D9725B]'
              }`}
            />
          ))}
        </div>
      </section>

      <ul className="flex flex-col gap-2">
        {assertions.map((a) => (
          <li key={a.k} className="flex items-start gap-2 text-[11px] leading-snug">
            <span
              data-status={a.status}
              className={`shrink-0 rounded border px-1 py-[1px] text-[9px] tracking-[0.1em] ${
                a.status === 'OK'
                  ? 'border-[#8FBF7A]/40 text-[#8FBF7A]'
                  : 'border-[#D9725B]/40 text-[#D9725B]'
              }`}
            >
              [{a.status}]
            </span>
            <span className="flex-1">
              <span className="text-[#F3C769]">{a.k}</span>
              <span className="ml-2 text-[#EAD9BC]/70">{a.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <footer className="flex items-center justify-between border-t border-[#F3C769]/15 pt-3 text-[11px]">
        <span className="text-[#9E8A6B]">next run</span>
        <span className="font-mono text-[#EAD9BC]">on commit · ~30s</span>
      </footer>
    </div>
  );
}
