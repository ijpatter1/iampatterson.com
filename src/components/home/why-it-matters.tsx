import { WHY_IT_MATTERS } from '@/lib/content/stats';

export function WhyItMatters() {
  return (
    <section className="bg-paper-alt py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          <div className="min-w-[280px] flex-[1.2]">
            <h2 className="font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-ink-3">
              {WHY_IT_MATTERS.eyebrow}
            </h2>
            <p className="mt-5 max-w-[52ch] text-base leading-[1.7] text-ink-2">
              {WHY_IT_MATTERS.body}
            </p>
          </div>
          <div className="min-w-[280px] flex-1">
            <div className="flex flex-wrap gap-x-10 gap-y-8">
              {WHY_IT_MATTERS.tiles.map((tile) => (
                <div key={tile.figure} className="min-w-[200px] flex-1 border-t border-rule pt-4">
                  <div className="font-display text-[64px] leading-none text-ink">
                    {tile.figure}
                  </div>
                  <p className="mt-3 text-sm leading-[1.6] text-ink-2">{tile.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              {WHY_IT_MATTERS.source}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
