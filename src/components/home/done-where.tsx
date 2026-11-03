import {
  BODY_CLASSES,
  CARD_TITLE_CLASSES,
  LABEL_CLASSES,
  SMALL_BODY_CLASSES,
  Section,
} from '@/components/home/section';
import { DONE_WHERE } from '@/lib/content/done-where';
import { NETWORKS, NETWORKS_LABEL } from '@/lib/content/networks';

export function DoneWhere() {
  return (
    <Section eyebrow={DONE_WHERE.eyebrow} eyebrowAs="h2">
      <div className="flex flex-wrap gap-x-8 gap-y-8">
        {DONE_WHERE.cards.map((card) => (
          <article key={card.name} className="min-w-[220px] flex-1 border-t border-rule pt-4">
            <h3 className={CARD_TITLE_CLASSES}>{card.name}</h3>
            <div className={`mt-1 ${LABEL_CLASSES}`}>{card.when}</div>
            <p className={`mt-3 ${SMALL_BODY_CLASSES}`}>{card.text}</p>
          </article>
        ))}
      </div>

      {/* Plain-text chips. */}
      <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span id="networks-label" className={LABEL_CLASSES}>
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

      <p className={`mt-12 max-w-[64ch] ${BODY_CLASSES}`}>{DONE_WHERE.closing}</p>
    </Section>
  );
}
