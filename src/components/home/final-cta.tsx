'use client';

import { EditorialButton, EditorialLink } from '@/components/chrome/editorial-button';
import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

export function FinalCta() {
  const { open } = useOverlay();

  return (
    <section data-testid="final-cta" className="border-t border-rule-soft bg-paper py-20 md:py-28">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <a
          href="mailto:ian@iampatterson.com"
          className="block font-mono text-[10px] uppercase tracking-widest text-accent-current"
          onClick={() => trackClickCta('contact, email', 'final_cta')}
        >
          contact, ian@iampatterson.com
        </a>
        <h2
          className="mt-5 font-display font-normal text-ink"
          style={{
            fontSize: 'clamp(56px, 10vw, 160px)',
            lineHeight: '0.92',
            letterSpacing: '-0.03em',
          }}
        >
          See your
          <br />
          session first.
          <br />
          <em className="text-accent-current">Then hire me.</em>
        </h2>
        <p className="mt-8 max-w-[52ch] text-base leading-[1.7] text-ink-2">
          Your session, live. Every event it fires, every destination it reaches, every consent
          decision, every transformation. Then we can talk about what you&apos;d build.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <EditorialButton
            variant="accent"
            onClick={() => {
              trackClickCta('See your session', 'final_cta');
              open();
            }}
          >
            See your session →
          </EditorialButton>
          <EditorialLink
            href="/contact"
            variant="ghost"
            onClick={() => trackClickCta('Start a conversation', 'final_cta')}
          >
            Start a conversation
          </EditorialLink>
        </div>
      </div>
    </section>
  );
}
