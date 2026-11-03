import type { ReactNode } from 'react';

/**
 * The homepage's shared frame and type roles (Ian, 2026-11-03). One place
 * for each, so the sections cannot drift apart again:
 *
 * - Eyebrow: the section's label. It is how a scanning reader finds their
 *   place, so it is readable (12px, ink-2), and it sits full width at the
 *   top of every section, above whatever the section lays out.
 * - Label: the small labels inside a section ("What I do", step numbers,
 *   sources). One size smaller and lighter than the eyebrow.
 * - Titles: section title, item title (questions and steps), card title.
 * - Section: one vertical rhythm, and alternating backgrounds so each
 *   section reads as its own room without oversized gaps.
 */
export const EYEBROW_CLASSES = 'font-mono text-xs uppercase tracking-[0.14em] text-ink-2';
export const LABEL_CLASSES = 'font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3';
export const SECTION_TITLE_CLASSES =
  'font-display text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.02] tracking-[-0.02em] text-ink';
export const ITEM_TITLE_CLASSES =
  'font-display text-[clamp(28px,3vw,40px)] font-normal leading-[1.1] tracking-[-0.01em] text-ink';
export const CARD_TITLE_CLASSES = 'font-display text-2xl font-normal leading-tight text-ink';
export const BODY_CLASSES = 'text-base leading-[1.7] text-ink-2';
export const SMALL_BODY_CLASSES = 'text-sm leading-[1.6] text-ink-2';

/** Vertical padding shared by every homepage section, the hero's bottom included. */
export const SECTION_PADDING_Y = 'py-14 md:py-20';

interface EyebrowProps {
  /** `h2` when the section has no display title of its own. */
  as?: 'p' | 'h2';
  children: ReactNode;
}

export function Eyebrow({ as: Tag = 'p', children }: EyebrowProps) {
  return (
    <Tag data-eyebrow="" className={`${EYEBROW_CLASSES} font-normal`}>
      {children}
    </Tag>
  );
}

interface SectionProps {
  id?: string;
  tone?: 'paper' | 'alt';
  eyebrow: ReactNode;
  eyebrowAs?: 'p' | 'h2';
  children: ReactNode;
}

export function Section({ id, tone = 'paper', eyebrow, eyebrowAs, children }: SectionProps) {
  return (
    <section
      id={id}
      className={`${tone === 'alt' ? 'bg-paper-alt' : 'bg-paper'} ${SECTION_PADDING_Y}`}
    >
      <div className="mx-auto max-w-content px-5 md:px-10">
        <Eyebrow as={eyebrowAs}>{eyebrow}</Eyebrow>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}
