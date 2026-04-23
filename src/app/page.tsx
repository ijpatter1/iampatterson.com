import { DemosSection } from '@/components/home/demos-section';
import { FinalCta } from '@/components/home/final-cta';
import { HeroEditorial } from '@/components/home/hero';
import { PipelineSection } from '@/components/home/pipeline-section';
import { ProofSection } from '@/components/home/proof-section';
import { ServicesTeaser } from '@/components/home/services-teaser';
import { warmMetabaseDashboardFireAndForget } from '@/lib/metabase/keep-warm';

// Force dynamic rendering (Phase 9F D9). The homepage was previously
// statically prerendered (○ in the build output), which meant the
// warmup hook below fired once at build time, not per-visitor, on
// Vercel prod. Dynamic rendering ensures the hook runs for each
// request so the module-scope 30-min debounce gates by real visit
// cadence. Performance cost is acceptable for a portfolio-traffic site.
export const dynamic = 'force-dynamic';

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
