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
      "An ad tech startup's order-to-platform pipeline, 2026. Meta, LinkedIn and Reddit Conversions APIs through server-side GTM at Allied Global Marketing, 2025. At UP, conversion tracking and audience sync for every ad platform as the paid program grew from 4 platforms to 14.",
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
      'Your paid media and sales data in accounts you own, with consent wired into the tags and the server container. Global Privacy Control honored, nothing fires before the choice. Consented orders matched directly; the rest estimated and labeled as estimates.',
    doneBefore:
      "OneTrust across UP's streaming service, as the legal team's contact for the work. Cookiebot and consent mode on this site: open the overlay and watch it enforce your choice.",
  },
];
