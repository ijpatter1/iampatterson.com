import { ContactForm } from '@/components/contact/contact-form';
import { DoneWhereNames } from '@/components/contact/done-where-names';
import { PrincipleCards } from '@/components/contact/principle-cards';
import { CtaLink } from '@/components/cta-link';
import {
  BODY_CLASSES,
  Eyebrow,
  LABEL_CLASSES,
  LABEL_STRONG_CLASSES,
  SMALL_BODY_CLASSES,
} from '@/components/home/section';
import { contactIntent } from '@/lib/contact/validate';
import { CONTACT_COPY, CONTACT_EMAIL, CONTACT_INTROS } from '@/lib/content/contact';

/**
 * The page title, sized for the left column it shares with the form (21.2):
 * smaller than the other pages' titles, so the form sits beside it.
 */
const CONTACT_TITLE_CLASSES =
  'font-display text-[clamp(44px,5vw,72px)] font-normal leading-[0.98] tracking-[-0.025em] text-ink';

interface ContactPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The contact page, with the about page folded in (16.2). `?intent=review`
 * (the review buttons) selects the review heading and intro. The heading sits
 * in the left column beside the form (21.2), so the whole form, Send included,
 * is above the fold on a laptop; the principles and "Where I've done it"
 * follow.
 */
export default async function ContactPage({ searchParams }: ContactPageProps) {
  const intent = contactIntent((await searchParams).intent);
  const intro = CONTACT_INTROS[intent];

  return (
    <main>
      <section className="bg-paper pb-14 pt-10 md:pb-20 md:pt-14">
        <div className="mx-auto flex max-w-content flex-wrap items-start gap-x-16 gap-y-10 px-5 md:px-10">
          <div className="min-w-[280px] max-w-[52ch] flex-1">
            <Eyebrow>{intro.eyebrow}</Eyebrow>
            <h1 className={`mt-5 text-balance ${CONTACT_TITLE_CLASSES}`}>{intro.title}</h1>
            <p className={`mt-7 ${BODY_CLASSES} md:text-lg`}>{intro.intro}</p>
            {intro.price && <p className={`mt-4 ${LABEL_STRONG_CLASSES}`}>{intro.price}</p>}
            {intro.turnaround && (
              <p className={`mt-1.5 ${SMALL_BODY_CLASSES}`}>{intro.turnaround}</p>
            )}
            {intro.reviewLink && (
              <p className={`mt-4 flex flex-wrap items-center gap-x-4 ${LABEL_STRONG_CLASSES}`}>
                <span>{intro.reviewLink.lead}</span>
                <CtaLink
                  href={intro.reviewLink.href}
                  ctaLocation="contact_review_link"
                  className={`${LABEL_CLASSES} inline-flex min-h-[44px] items-center underline decoration-rule underline-offset-4 transition-colors hover:text-ink`}
                >
                  {intro.reviewLink.text}
                  <span aria-hidden="true">&nbsp;→</span>
                </CtaLink>
              </p>
            )}
            <div className="mt-5 border-t border-rule pt-4">
              <div className={LABEL_CLASSES}>{CONTACT_COPY.emailLabel}</div>
              <CtaLink
                href={`mailto:${CONTACT_EMAIL}`}
                ctaLocation="contact_email"
                className="mt-1 inline-flex min-h-[44px] items-center font-display text-2xl text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
              >
                {CONTACT_EMAIL}
              </CtaLink>
              <p className={`mt-2 ${SMALL_BODY_CLASSES}`}>{CONTACT_COPY.response}</p>
            </div>
          </div>
          <div className="min-w-[300px] flex-[1.2]">
            <ContactForm intent={intent} />
          </div>
        </div>
      </section>

      <PrincipleCards />

      <DoneWhereNames />
    </main>
  );
}
