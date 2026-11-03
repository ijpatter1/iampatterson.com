import {
  BODY_CLASSES,
  ITEM_TITLE_CLASSES,
  LABEL_CLASSES,
  SMALL_BODY_CLASSES,
  STAT_FIGURE_CLASSES,
  Section,
} from '@/components/home/section';
import { PROBLEMS, PROBLEMS_EYEBROW, PROBLEM_LABELS } from '@/lib/content/problems';

/**
 * The three questions, stacked vertically (the three steps below run
 * horizontally). Each question's figures sit under it, in its own column, so
 * the evidence frames the question and the answer reads beside both.
 */
export function Problems() {
  return (
    <Section tone="alt" eyebrow={PROBLEMS_EYEBROW}>
      <div className="border-t border-ink">
        {PROBLEMS.map((problem) => (
          <article
            key={problem.num}
            className="flex flex-wrap gap-x-16 gap-y-8 border-b border-rule-soft py-10 md:py-12"
          >
            <div className="min-w-[280px] flex-1">
              <div className={LABEL_CLASSES}>{problem.num}</div>
              <h2 className={`mt-3 max-w-[18ch] ${ITEM_TITLE_CLASSES}`}>{problem.title}</h2>
              {problem.evidence && (
                <div className="mt-8">
                  <div className="flex flex-wrap gap-x-8 gap-y-6">
                    {problem.evidence.tiles.map((tile) => (
                      <div
                        key={tile.figure}
                        className="min-w-[150px] flex-1 border-t border-rule pt-4"
                      >
                        <div className={STAT_FIGURE_CLASSES}>{tile.figure}</div>
                        <p className={`mt-3 ${SMALL_BODY_CLASSES}`}>{tile.text}</p>
                      </div>
                    ))}
                  </div>
                  <p className={`mt-4 ${LABEL_CLASSES}`}>{problem.evidence.source}</p>
                </div>
              )}
            </div>
            <div className="min-w-[280px] flex-[1.2] space-y-6">
              <div>
                <div className={LABEL_CLASSES}>{PROBLEM_LABELS.whatIDo}</div>
                <p className={`mt-2 max-w-[60ch] ${BODY_CLASSES}`}>{problem.whatIDo}</p>
              </div>
              <div>
                <div className={LABEL_CLASSES}>{PROBLEM_LABELS.doneBefore}</div>
                <p className={`mt-2 max-w-[60ch] ${BODY_CLASSES}`}>{problem.doneBefore}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
