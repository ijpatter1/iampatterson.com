export interface Problem {
  num: '01' | '02' | '03';
  title: string;
  whatIDo: string;
  doneBefore: string;
}

export const PROBLEMS_EYEBROW = 'What I get called for · Three problems';
export const PROBLEM_LABELS = { whatIDo: 'What I do', doneBefore: 'Done before' } as const;

export const PROBLEMS: Problem[] = [
  {
    num: '01',
    title: 'The platforms claim more than you sold.',
    whatIDo:
      "A table of your real orders, and each platform's claims read against it: claimed, verified from its own click IDs, sold. The gap splits into configuration and tracking defects. I fix both.",
    doneBefore:
      'UP Entertainment, a streaming subscription business spending six figures a week on paid media, where the platforms claimed more purchases than the business sold. Subscription data accuracy went from about 30 percent to over 98 percent.',
  },
  {
    num: '02',
    title: 'The platforms are optimizing on incomplete data.',
    whatIDo:
      'Conversions from the server, and the ones the browser never sees: renewals, billing-system orders, deals that close in your CRM, each with its value. Meta and Google Conversions APIs, enhanced conversions, offline conversions through Data Manager.',
    doneBefore:
      "An ad tech startup's order-to-platform pipeline, 2026. Meta, LinkedIn and Reddit Conversions APIs through server-side GTM at Allied Global Marketing, 2025. At UP, conversion tracking and audience sync for every ad platform as the paid program grew from 4 platforms to 14.",
  },
  {
    num: '03',
    title: 'Tracking has to respect consent without breaking measurement.',
    whatIDo:
      'The banner wired into the tags and the server container. Global Privacy Control honored, nothing fires before the choice. Consented orders matched directly; the rest estimated and labeled as estimates.',
    doneBefore:
      "OneTrust across UP's streaming service, as the legal team's contact for the work. Cookiebot and consent mode on this site: open the overlay and watch it enforce your choice.",
  },
];
