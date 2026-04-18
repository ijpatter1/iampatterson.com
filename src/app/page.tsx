import { DemosSection } from '@/components/home/demos-section';
import { FinalCta } from '@/components/home/final-cta';
import { HeroEditorial } from '@/components/home/hero';
import { PipelineSection } from '@/components/home/pipeline-section';
import { ProofSection } from '@/components/home/proof-section';
import { ServicesTeaser } from '@/components/home/services-teaser';

export default function HomePage() {
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
