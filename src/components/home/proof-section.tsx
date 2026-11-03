'use client';

import { EditorialButton } from '@/components/chrome/editorial-button';
import { ProofPanel } from '@/components/home/proof-panel';
import { BODY_CLASSES, SECTION_TITLE_CLASSES, Section } from '@/components/home/section';
import { useOverlay } from '@/components/overlay/overlay-context';
import { PROOF } from '@/lib/content/proof';
import { trackClickCta } from '@/lib/events/track';

export function ProofSection() {
  const { open } = useOverlay();

  // One handler for the button and the panel: both are the Proof section's
  // "open the overlay", on the timeline.
  const handleOpen = () => {
    trackClickCta(PROOF.cta, 'proof');
    open('timeline');
  };

  return (
    <Section id="proof" tone="alt" eyebrow={PROOF.eyebrow}>
      {/* The eyebrow sits above both columns, so the panel's top lines up
          with the title rather than with the section's edge. */}
      <div className="flex flex-wrap items-start gap-x-16 gap-y-10">
        <div className="min-w-[280px] flex-1">
          <h2 className={SECTION_TITLE_CLASSES}>{PROOF.title}</h2>
          <p className={`mt-5 max-w-[52ch] ${BODY_CLASSES}`}>{PROOF.body}</p>
          <div className="mt-7">
            <EditorialButton variant="ghost" onClick={handleOpen}>
              {PROOF.cta} →
            </EditorialButton>
          </div>
        </div>
        <div className="min-w-[280px] flex-[1.1] lg:pt-2">
          <ProofPanel onOpen={handleOpen} />
        </div>
      </div>
    </Section>
  );
}
