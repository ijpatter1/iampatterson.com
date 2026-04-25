import { after } from 'next/server';

import { DemosSection } from '@/components/home/demos-section';
import { FinalCta } from '@/components/home/final-cta';
import { HeroEditorial } from '@/components/home/hero';
import { PipelineSection } from '@/components/home/pipeline-section';
import { ServicesTeaser } from '@/components/home/services-teaser';
import { warmMetabaseDashboard } from '@/lib/metabase/keep-warm';

// Force dynamic rendering (Phase 9F D9). The homepage was previously
// statically prerendered (○ in the build output), which meant the
// warmup hook below fired once at build time, not per-visitor, on
// Vercel prod. Dynamic rendering ensures the hook runs for each
// request so the module-scope 30-min debounce gates by real visit
// cadence. `after()` also only fires on dynamic requests, so this
// export remains load-bearing under Next 15+.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  // Organic Metabase warmup (Phase 9F D9 → 10a D2). `after()` runs the
  // warmup after the response is flushed but before Vercel freezes the
  // Lambda, so the 5–15s BigQuery card fan-out isn't truncated mid-flight
  // the way a bare fire-and-forget would be. Module-scope 30-min debounce
  // inside warmMetabaseDashboard rate-limits concurrent homepage renders.
  after(() => warmMetabaseDashboard());
  return (
    <main>
      <HeroEditorial />
      <PipelineSection />
      <DemosSection />
      <ServicesTeaser />
      <FinalCta />
    </main>
  );
}
