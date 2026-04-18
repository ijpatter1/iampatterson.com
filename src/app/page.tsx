import { DemosSection } from '@/components/home/demos-section';
import { HeroEditorial } from '@/components/home/hero';
import { PipelineSection } from '@/components/home/pipeline-section';
import { ServicesTeaser } from '@/components/home/services-teaser';

export default function HomePage() {
  return (
    <main>
      <HeroEditorial />
      <PipelineSection />
      <DemosSection />
      <ServicesTeaser />
    </main>
  );
}
