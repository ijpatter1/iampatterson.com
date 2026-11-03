import { PROBLEMS, PROBLEMS_EYEBROW, PROBLEM_LABELS } from '@/lib/content/problems';

const labelClasses = 'font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3';

export function Problems() {
  return (
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          {PROBLEMS_EYEBROW}
        </p>
        <div className="mt-6 border-t border-ink">
          {PROBLEMS.map((problem) => (
            <article
              key={problem.num}
              className="flex flex-wrap gap-x-16 gap-y-6 border-b border-rule-soft py-10 md:py-14"
            >
              <div className="min-w-[280px] flex-1">
                <div className="font-mono text-[11px] tracking-[0.14em] text-ink-3">
                  {problem.num}
                </div>
                <h2 className="mt-3 max-w-[18ch] font-display text-[clamp(30px,3.4vw,44px)] font-normal leading-[1.08] tracking-[-0.01em] text-ink">
                  {problem.title}
                </h2>
              </div>
              <div className="min-w-[280px] flex-[1.3] space-y-6">
                <div>
                  <div className={labelClasses}>{PROBLEM_LABELS.whatIDo}</div>
                  <p className="mt-2 max-w-[60ch] text-base leading-[1.7] text-ink-2">
                    {problem.whatIDo}
                  </p>
                </div>
                {problem.evidence && (
                  <div>
                    <div className="flex flex-wrap gap-x-10 gap-y-6">
                      {problem.evidence.tiles.map((tile) => (
                        <div
                          key={tile.figure}
                          className="min-w-[200px] flex-1 border-t border-rule pt-4"
                        >
                          <div className="font-display text-[56px] leading-none text-ink">
                            {tile.figure}
                          </div>
                          <p className="mt-3 text-sm leading-[1.6] text-ink-2">{tile.text}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                      {problem.evidence.source}
                    </p>
                  </div>
                )}
                <div>
                  <div className={labelClasses}>{PROBLEM_LABELS.doneBefore}</div>
                  <p className="mt-2 max-w-[60ch] text-base leading-[1.7] text-ink-2">
                    {problem.doneBefore}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
