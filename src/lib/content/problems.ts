import { BUDGET_FIGURES, type Evidence } from './stats';

export interface Problem {
  num: '01' | '02' | '03';
  title: string;
  whatIDo: string;
  doneBefore: string;
  /** Sourced figures that back the answer. */
  evidence?: Evidence;
}

export const PROBLEMS_EYEBROW = 'What I get called for · Three questions';
export const PROBLEM_LABELS = { whatIDo: 'What I do', doneBefore: 'Done before' } as const;

/** The three questions from the LinkedIn profile's About, each with the problem it answers. */
export const PROBLEMS: Problem[] = [
  {
    num: '01',
    title: 'Is the budget going to the right places?',
    whatIDo:
      'Conversions from the server, and the ones the browser never sees: renewals, billing-system orders, deals that close in your CRM, each with its value, flow back to the ad platforms with consent. Meta and Google Conversions APIs, enhanced conversions, offline conversions through Data Manager.',
    doneBefore:
      "AdZeta's order-to-platform pipeline, 2026. Meta, LinkedIn and Reddit Conversions APIs through server-side GTM at Allied Global Marketing, 2025.",
    evidence: BUDGET_FIGURES,
  },
  {
    num: '02',
    title: 'Does anybody trust these numbers?',
    whatIDo:
      "A table of your real orders, and each platform's claims read against it: claimed, verified from its own click IDs, sold. The gap splits into configuration and tracking defects. I fix both.",
    doneBefore:
      'UP Entertainment, a streaming subscription business spending six figures a week on paid media, where the platforms claimed more purchases than the business sold. Subscription data accuracy went from about 30 percent to over 98 percent.',
  },
  {
    num: '03',
    title: 'Who owns this data?',
    whatIDo:
      "Your paid media and sales data in accounts you own: the warehouse, the server container and the reports built on them. Adding an ad platform's Conversions API becomes a change your team makes in a container it controls, not a request in the developer queue; I set it up and show your team how. The same data feeds your reporting and your audiences, and consent is wired in once, so every new destination follows it.",
    doneBefore:
      "At UP, the paid program moved through 14 ad platforms in three years, each receiving conversions and audiences from systems I owned. OneTrust across the streaming service, as the legal team's contact. This site runs the same setup: open the overlay and watch it enforce your choice.",
  },
];
