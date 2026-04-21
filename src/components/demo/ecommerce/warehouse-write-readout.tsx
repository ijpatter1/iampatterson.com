'use client';

import { bqRowForCart, type LiveCheckoutContext } from '@/lib/demo/reveal/warehouse-write';

/**
 * Warehouse-write Tier 2 readout — children of `LiveSidebar` on the
 * checkout page. Renders the row preview being written to BigQuery with
 * cart-reactive fields (`cart_value`, `cart_item_count`, `items`) updated
 * live as the visitor modifies cart state. When live session context is
 * supplied, `session_id`, `event_timestamp`, `received_timestamp`, and the
 * two consent flags also substitute with the visitor's real values
 * (UAT r1 items 11 + 13).
 */
export function WarehouseWriteReadout({
  total,
  itemCount,
  uniqueItems,
  live,
}: {
  total: number;
  itemCount: number;
  uniqueItems: number;
  live?: LiveCheckoutContext;
}) {
  const cols = bqRowForCart({ total, itemCount, uniqueItems, live });
  const utmIsExample = live?.utmIsLive === false;
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between text-[11px]">
        <span className="text-[#9E8A6B]">table</span>
        <span className="font-mono text-[#EAD9BC]">iampatterson_raw.events_raw</span>
      </header>
      <p className="text-[11px] leading-snug text-[#EAD9BC]/70">
        This is the row that will be <span className="text-[#F3C769]">inserted</span> when the
        purchase event fires. {cols.length} of 51 columns shown.{' '}
        <span className="text-[#9E8A6B]">
          {utmIsExample
            ? 'utm_* / client_id / geo_country are example seeds — no utm_campaign in your url.'
            : 'client_id / geo_country are example seeds; the remaining visitor-scoped columns reflect your real session.'}
        </span>
      </p>

      <div className="flex flex-col gap-[2px] font-mono text-[10px]">
        {cols.map((c) => (
          <div key={c.k} className="grid grid-cols-[1fr_1fr_60px] gap-2 py-[2px] text-[#EAD9BC]">
            <span className="text-[#F3C769]">{c.k}</span>
            <span className="truncate text-[#EAD9BC]/90">{c.v}</span>
            <span className="text-right text-[9px] text-[#9E8A6B]">{c.type}</span>
          </div>
        ))}
      </div>

      <footer className="flex items-center gap-2 border-t border-[#F3C769]/15 pt-3 text-[11px]">
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#8FBF7A]"
        />
        <span className="text-[#EAD9BC]">stream · p50 38ms · p95 112ms</span>
      </footer>
    </div>
  );
}
