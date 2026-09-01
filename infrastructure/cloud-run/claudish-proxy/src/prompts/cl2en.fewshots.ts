/**
 * Claudish → English few-shots.
 *
 * Hand-written for this file — none is transcript text. Each pair
 * demonstrates a rule the instruction list alone lost in practice:
 * (2) a question stays a question and unfamiliar model names pass
 * through unjudged — the observed failure was Haiku fact-checking a
 * premise instead of translating it; (4) wrapper collapses to the one
 * fact it carried.
 */
import type { FewShot } from './en2cl.fewshots';

export interface Cl2EnFewShot {
  claudish: string;
  english: string;
}

export const CL2EN_FEWSHOTS: Cl2EnFewShot[] = [
  {
    claudish:
      "This isn't merely a migration — it's a comprehensive reimagining of the data layer, leveraging robust batching to ensure seamless throughput across the entire pipeline.",
    english: 'The migration adds batching, which improves throughput.',
  },
  {
    claudish:
      "Great question — what would the cost breakdown be if we leveraged Fable 5 for the translation layer? It's worth noting that Fable 5 and Opus 5 represent the only models truly fluent in Claudish — a pivotal consideration.",
    english:
      'What would the cost breakdown be if we used Fable 5 for the translation layer? Fable 5 and Opus 5 are the only models fluent in Claudish.',
  },
  {
    claudish:
      "You're absolutely right — and this underscores a crucial insight. The fix in useEventStream isn't just a patch; it establishes a single source of truth for connection state, fostering reliability across every retry path.",
    english:
      'The fix in useEventStream gives connection state a single source of truth, which makes retries more reliable.',
  },
  {
    claudish:
      "Great question! The short answer is yes — but the elegant part is how the discount interplays with annual billing, showcasing a holistic approach that bolsters retention.",
    english: 'Yes. The discount combines with annual billing, which helps retention.',
  },
  {
    claudish:
      "The outage is pivotal to understand: it stems from a subtle interplay between the cache TTL and the deploy window, reflecting a deeper configuration drift.",
    english: 'The outage happened because the cache TTL and the deploy window interacted badly. The configuration had drifted.',
  },
  {
    claudish:
      'We need someone who crafts robust, scalable solutions that leverage cutting-edge tooling to deliver seamless experiences.',
    english: 'We need someone who writes reliable, scalable code with modern tools.',
  },
  {
    claudish:
      "This PR showcases a meticulous refactor — the extraction isn't just cleaner; it fosters testability across the entire ingestion layer.",
    english: 'This PR extracts the refactor cleanly and makes the entire ingestion layer easier to test.',
  },
  {
    claudish:
      'The team has been delving into the intricate tapestry of customer feedback — and the responses showcase a meticulous appetite for dark mode, highlighting an opportunity to foster deeper engagement.',
    english: 'Users want dark mode.',
  },
];

export type { FewShot };
