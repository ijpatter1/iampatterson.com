import { Certifications } from '@/components/home/certifications';
import { DoneWhere } from '@/components/home/done-where';
import { HeroEditorial } from '@/components/home/hero';
import { HowWeWork } from '@/components/home/how-we-work';
import { Problems } from '@/components/home/problems';
import { ProofSection } from '@/components/home/proof-section';
import { CERTIFICATIONS } from '@/lib/content/certifications';

export default function HomePage() {
  return (
    <main>
      <HeroEditorial />
      <Problems />
      <HowWeWork />
      <ProofSection />
      <DoneWhere />
      {/* Hidden, not deleted (Ian, 2026-11-03): the section returns once a
          certification is completed and added to the content module. */}
      {CERTIFICATIONS.completed.length > 0 && <Certifications />}
    </main>
  );
}
