import { DONE_WHERE } from '@/lib/content/done-where';
import { NETWORKS, NETWORKS_LABEL } from '@/lib/content/networks';

export function DoneWhere() {
  return (
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h2 className="font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-ink-3">
          {DONE_WHERE.eyebrow}
        </h2>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-8">
          {DONE_WHERE.cards.map((card) => (
            <article key={card.name} className="min-w-[220px] flex-1 border-t border-rule pt-4">
              <h3 className="font-display text-2xl font-normal leading-tight text-ink">
                {card.name}
              </h3>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {card.when}
              </div>
              <p className="mt-3 text-sm leading-[1.6] text-ink-2">{card.text}</p>
            </article>
          ))}
        </div>

        {/* Plain-text chips. */}
        <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span
            id="networks-label"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3"
          >
            {NETWORKS_LABEL}
          </span>
          <ul aria-labelledby="networks-label" className="flex flex-wrap gap-2">
            {NETWORKS.map((network) => (
              <li
                key={network}
                className="rounded-sm border border-rule-soft px-3 py-1.5 font-mono text-[11px] text-ink-2"
              >
                {network}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-12 max-w-[64ch] text-base leading-[1.7] text-ink-2">
          {DONE_WHERE.closing}
        </p>
      </div>
    </section>
  );
}
