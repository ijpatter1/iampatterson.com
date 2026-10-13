'use client';

import { EditorialButton } from '@/components/chrome/editorial-button';
import { ProofPanel } from '@/components/home/proof-panel';
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
    <section id="proof" className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          <div className="min-w-[280px] flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              {PROOF.eyebrow}
            </p>
            <h2 className="mt-4 font-display text-[clamp(34px,4vw,56px)] font-normal leading-[1.05] tracking-[-0.015em] text-ink">
              {PROOF.title}
            </h2>
            <p className="mt-5 max-w-[52ch] text-base leading-[1.7] text-ink-2">{PROOF.body}</p>
            <div className="mt-7">
              <EditorialButton variant="ghost" onClick={handleOpen}>
                {PROOF.cta} →
              </EditorialButton>
            </div>
          </div>
          <div className="min-w-[280px] flex-[1.1]">
            <ProofPanel onOpen={handleOpen} />
          </div>
        </div>
      </div>
    </section>
  );
}
