/* eslint-disable @next/next/no-img-element -- issued badges are small static files */
import { CERTIFICATIONS, type CompletedCertification } from '@/lib/content/certifications';

const eyebrowClasses = 'font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3';
const rowClasses =
  'flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule-soft py-3';

interface CertificationsProps {
  /** Defaults to the content module. A prop so the completed layout can be exercised before any exists. */
  completed?: readonly CompletedCertification[];
}

export function Certifications({ completed = CERTIFICATIONS.completed }: CertificationsProps) {
  const hasCompleted = completed.length > 0;

  return (
    <section id="certifications" className="bg-paper-alt py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h2 className={`${eyebrowClasses} font-normal`}>{CERTIFICATIONS.eyebrow}</h2>
        <div className="mt-6 flex flex-wrap gap-x-16 gap-y-10">
          <div className="min-w-[280px] flex-1">
            <h3 className={`${eyebrowClasses} font-normal`}>{CERTIFICATIONS.upNextLabel}</h3>
            <ul className="mt-3 border-t border-rule">
              {CERTIFICATIONS.upNext.map((cert) => (
                <li key={cert.name} className={rowClasses}>
                  <span className="text-base text-ink">{cert.name}</span>
                  <span className="font-mono text-[11px] text-ink-3">{cert.issuer}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rendered only when there is a completed certification. A badge
              renders only when one is set; there is no empty slot. */}
          {hasCompleted && (
            <div className="min-w-[280px] flex-1">
              <h3 className={`${eyebrowClasses} font-normal`}>{CERTIFICATIONS.completedLabel}</h3>
              <ul className="mt-3 border-t border-rule">
                {completed.map((cert) => (
                  <li key={cert.name} className={`${rowClasses} items-center`}>
                    <span className="flex items-center gap-3 text-base text-ink">
                      {cert.badgeSrc && <img src={cert.badgeSrc} alt="" width={40} height={40} />}
                      {cert.name}
                    </span>
                    <span className="font-mono text-[11px] text-ink-3">
                      {cert.issuer} · {cert.year}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
