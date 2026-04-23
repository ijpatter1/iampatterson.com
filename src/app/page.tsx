import { DemosSection } from '@/components/home/demos-section';
import { FinalCta } from '@/components/home/final-cta';
import { HeroEditorial } from '@/components/home/hero';
import { PipelineSection } from '@/components/home/pipeline-section';
import { ProofSection } from '@/components/home/proof-section';
import { ServicesTeaser } from '@/components/home/services-teaser';
import { warmMetabaseDashboardFireAndForget } from '@/lib/metabase/keep-warm';

export default function HomePage() {
  // Organic Metabase warmup (Phase 9F D9). Server-side, never awaited.
  // Module-scope 30-min debounce rate-limits concurrent homepage renders.
  warmMetabaseDashboardFireAndForget();
  return (
    <main>
      <HeroEditorial />
      <PipelineSection />
      <DemosSection />
      <ServicesTeaser />
      <ProofSection />
      <FinalCta />
    </main>
  );
}
