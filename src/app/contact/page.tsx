import Link from 'next/link';

import { ContactForm } from '@/components/contact/contact-form';
import { DoneWhere } from '@/components/home/done-where';
import {
  BODY_CLASSES,
  Eyebrow,
  ITEM_TITLE_CLASSES,
  LABEL_CLASSES,
  LABEL_STRONG_CLASSES,
  PAGE_TITLE_CLASSES,
  SECTION_PADDING_BOTTOM,
  SMALL_BODY_CLASSES,
  Section,
} from '@/components/home/section';
import {
  CONTACT_COPY,
  CONTACT_EMAIL,
  CONTACT_INTROS,
  PRINCIPLES,
  contactIntent,
} from '@/lib/content/contact';

interface ContactPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The contact page, with the about page folded in (16.2). `?intent=review`
 * (the review buttons) selects the review heading and intro. The form sits
 * at the top for both intents, so a visitor who has decided reaches it
 * without scrolling; the principles and "Where I've done it" follow.
 */
export default async function ContactPage({ searchParams }: ContactPageProps) {
  const intro = CONTACT_INTROS[contactIntent((await searchParams).intent)];

  return (
    <main>
      <section className={`bg-paper pt-8 md:pt-16 ${SECTION_PADDING_BOTTOM}`}>
        <div className="mx-auto max-w-content px-5 md:px-10">
          <Eyebrow>{intro.eyebrow}</Eyebrow>
          <h1 className={`mt-5 text-balance ${PAGE_TITLE_CLASSES}`}>{intro.title}</h1>
          <div className="mt-10 flex flex-wrap items-start gap-x-16 gap-y-10 border-t border-rule-soft pt-8">
            <div className="min-w-[280px] max-w-[52ch] flex-1">
              <p className={`${BODY_CLASSES} md:text-lg`}>{intro.intro}</p>
              {intro.facts && <p className={`mt-4 ${LABEL_STRONG_CLASSES}`}>{intro.facts}</p>}
              {intro.reviewLink && (
                <p className={`mt-4 flex flex-wrap items-center gap-x-4 ${LABEL_STRONG_CLASSES}`}>
                  <span>{intro.reviewLink.lead}</span>
                  <Link
                    href={intro.reviewLink.href}
                    className={`${LABEL_CLASSES} inline-flex min-h-[44px] items-center underline decoration-rule underline-offset-4 transition-colors hover:text-ink`}
                  >
                    {intro.reviewLink.text}
                    <span aria-hidden="true">&nbsp;→</span>
                  </Link>
                </p>
              )}
              <div className="mt-8 border-t border-rule pt-4">
                <div className={LABEL_CLASSES}>{CONTACT_COPY.emailLabel}</div>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-2 inline-block font-display text-2xl text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                >
                  {CONTACT_EMAIL}
                </a>
                <p className={`mt-3 ${SMALL_BODY_CLASSES}`}>{CONTACT_COPY.response}</p>
              </div>
            </div>
            <div className="min-w-[300px] flex-[1.2]">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      <Section tone="alt" eyebrow={PRINCIPLES.eyebrow} eyebrowAs="h2">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {PRINCIPLES.items.map((principle) => (
            <div key={principle.title} className="border-t border-ink pt-5">
              <h3 className={ITEM_TITLE_CLASSES}>{principle.title}</h3>
              <p className={`mt-3 ${BODY_CLASSES}`}>{principle.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <DoneWhere />
    </main>
  );
}
