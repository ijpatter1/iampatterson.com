'use client';

import { stagingRowsForProduct, STAGING_STITCH_OPS } from '@/lib/demo/reveal/staging-layer';

/**
 * Staging-layer Tier 2 readout — rendered as children of `LiveSidebar` on
 * the product-detail page. Shows the raw → typed cast table with the
 * visitor's current product substituted + the four stitch-and-enrich ops
 * as an `[OK]` checklist + the `→ stg_product_views [written]` destination
 * footer per the prototype.
 */
export function StagingLayerReadout({ product }: { product: { id: string; price: number } }) {
  const rows = stagingRowsForProduct(product);
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-2">
        <header className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] tracking-[0.1em] text-[#F3C769]">01</span>
          <span className="text-[11px] uppercase tracking-[0.1em] text-[#EAD9BC]">
            raw → typed cast
          </span>
        </header>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-[#9E8A6B]">
              <th className="py-1 font-normal">field</th>
              <th className="py-1 font-normal">raw</th>
              <th className="py-1 font-normal">typed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="align-top text-[11px]">
                <td className="py-[3px] pr-2 text-[#F3C769]">{r.k}</td>
                <td className="py-[3px] pr-2 text-[#EAD9BC]/80">{r.raw}</td>
                <td className="py-[3px] text-[#EAD9BC]">
                  <div>{r.typed}</div>
                  <div className="text-[9px] uppercase tracking-[0.08em] text-[#9E8A6B]">
                    [{r.cast}]
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2 border-t border-[#F3C769]/15 pt-3">
        <header className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] tracking-[0.1em] text-[#F3C769]">02</span>
          <span className="text-[11px] uppercase tracking-[0.1em] text-[#EAD9BC]">
            stitch &amp; enrich
          </span>
        </header>
        <ul className="flex flex-col gap-1.5">
          {STAGING_STITCH_OPS.map((o) => (
            <li key={o.op} className="flex items-start gap-2 text-[11px] leading-snug">
              <span
                data-status={o.status}
                className="shrink-0 rounded border border-[#8FBF7A]/40 px-1 py-[1px] text-[9px] tracking-[0.1em] text-[#8FBF7A]"
              >
                [{o.status}]
              </span>
              <span className="flex-1">
                <span className="text-[#F3C769]">{o.op}</span>
                <span className="ml-2 text-[#EAD9BC]/70">{o.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center gap-2 border-t border-[#F3C769]/15 pt-3 text-[11px]">
        <span className="text-[#F3C769]">→</span>
        <span className="text-[#EAD9BC]">stg_product_views</span>
        <span
          data-status="OK"
          className="ml-auto rounded border border-[#8FBF7A]/40 px-1 py-[1px] text-[9px] tracking-[0.1em] text-[#8FBF7A]"
        >
          [written]
        </span>
      </section>
    </div>
  );
}
