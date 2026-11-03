/** The review's starting price. One field, so a change is one line. */
export const REVIEW_PRICE = '$2,500';

/** The page that sets the review out (15.10). Every review link goes here. */
export const REVIEW_PAGE_HREF = '/review';

/** Where the booking buttons go: the contact page, with the review intent. */
export const BOOK_REVIEW_HREF = '/contact?intent=review';

export interface WorkStep {
  num: '01' | '02' | '03';
  label: string;
  /** The step's line on the LinkedIn banner. */
  line: string;
  body: string;
  price?: string;
  link?: { text: string; href: string };
}

/** "How teams work with me": the banner's three steps, with the About's sentences. */
export const HOW_WE_WORK = {
  eyebrow: 'How teams work with me',
  title: 'Start with a review.',
  steps: [
    {
      num: '01',
      label: 'Review',
      line: 'What your tracking misses, and what to fix',
      body: "A paid review, and I make no changes. I document what your tracking captures and what it misses, check each ad platform's claims against your orders, and rank the findings by impact. You decide what to fix.",
      price: `From ${REVIEW_PRICE}`,
      link: { text: 'What the review includes', href: REVIEW_PAGE_HREF },
    },
    {
      num: '02',
      label: 'Build',
      line: 'Data you own, and AI your team can rely on',
      body: "A build with a fixed scope. Before it starts, we agree how we'll measure what it changes. Conversions flow back to the ad platforms with consent, your paid media and sales data lands in accounts you own, and then the AI: your team asks about spend and sales, and checks the answers in data they trust. I set the rules for what the AI can see and change, and who signs off on its changes.",
    },
    {
      num: '03',
      label: 'Lead',
      line: "Senior leadership, where there's a fit",
      body: 'A retainer, or fractional leadership if nobody on your team owns marketing data, measurement and AI at a senior level.',
    },
  ] satisfies WorkStep[],
  cta: 'Start with a review',
} as const;

export interface ReviewColumn {
  label: string;
  text: string;
}

/**
 * The review page's give, get and then columns (15.10). Signed 2026-10-12;
 * "You give me" and "You get" rewritten on 2026-11-03 from what a real
 * review asked for and delivered. "Then" is unchanged.
 */
export const REVIEW_COLUMNS = [
  {
    label: 'You give me',
    text: 'Read access to Tag Manager, your analytics and its warehouse, and the ad accounts. An order export from your system of record. A kickoff session with your team.',
  },
  {
    label: 'You get',
    text: "A first summary after the kickoff. A recorded walkthrough with your team. The written review, with each platform's claims against your orders and the evidence for each finding. The plan as a working tracker: ranked, with owners and estimated effort. Your data back, deleted on my side.",
  },
  {
    label: 'Then',
    text: 'Fixes and builds as scoped projects. Every account and asset in your name. A runbook at handoff.',
  },
] satisfies ReviewColumn[];
