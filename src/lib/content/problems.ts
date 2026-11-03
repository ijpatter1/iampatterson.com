import { CUSTOMER_FIGURES, OWNERSHIP_FIGURES, TRUST_FIGURES, type Evidence } from './stats';

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
    title: 'Do the platforms know who our best customers are?',
    whatIDo:
      'Conversions from the server, and the ones the browser never sees: renewals, billing-system orders, deals that close in your CRM, each with its value, flow back to the ad platforms with consent. Meta and Google Conversions APIs, enhanced conversions, offline conversions through Data Manager.',
    doneBefore:
      'AdZeta, 2026: predicted lifetime value sent to Google, Meta and TikTok, so their bidding goes after the customers who stick and repurchase. Meta, LinkedIn and Reddit Conversions APIs through server-side GTM at Allied Global Marketing, 2025.',
    evidence: CUSTOMER_FIGURES,
  },
  {
    num: '02',
    title: 'Does anybody trust these numbers?',
    whatIDo:
      "A table of your real orders, and each platform's claims read against it: claimed, verified from its own click IDs, sold. The gap splits into configuration and tracking defects, and I fix both. The AI sits on that same table, so when your team asks about spend or sales, they can check the answer against numbers they already trust.",
    doneBefore:
      'UP Entertainment, a streaming subscription business spending six figures a week on paid media, where the platforms claimed more purchases than the business sold. Subscription data accuracy went from about 30 percent to over 98 percent.',
    evidence: TRUST_FIGURES,
  },
  {
    num: '03',
    title: 'Who owns this data?',
    whatIDo:
      "Your paid media and sales data in accounts you own: the warehouse, the server container and the reports built on them. Adding an ad platform's Conversions API becomes a change your team makes in a container it controls, not a request in the developer queue; I set it up and show your team how. The same data feeds your reporting and your audiences, and consent is wired in once, so every new destination follows it.",
    doneBefore:
      "At UP, the paid program moved through 14 ad platforms in three years, each receiving conversions and audiences from systems I owned. OneTrust across the streaming service, as the legal team's contact. Cookiebot and consent mode on this site: open the overlay and watch it enforce your choice.",
    evidence: OWNERSHIP_FIGURES,
  },
];
