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

/** One line of a give or get column: a whole sentence, unchanged. */
export interface ReviewColumnItem {
  text: string;
  /** The words that open the sentence, set in bold on the "You get" checklist. */
  lead?: string;
}

export interface ReviewColumn {
  label: string;
  items: ReviewColumnItem[];
}

/**
 * The review page's give and get columns (15.10). Signed 2026-10-12;
 * "You give me" and "You get" rewritten by Ian on 2026-11-03; "Then" folded
 * into the page's Build step the same day. Set as lists, one sentence per
 * item with no word changed, in 21.1.
 */
export const REVIEW_COLUMNS = [
  {
    label: 'You give me',
    items: [
      {
        text: 'Read access to Tag Manager, your analytics and its warehouse, and the ad accounts.',
      },
      { text: 'An order export from your system of record.' },
      { text: 'A kickoff session with your team.' },
    ],
  },
  {
    label: 'You get',
    items: [
      { lead: 'A first summary', text: 'A first summary after the kickoff.' },
      { lead: 'A recorded walkthrough', text: 'A recorded walkthrough with your team.' },
      {
        lead: 'The written review',
        text: "The written review, with each platform's claims against your orders and the evidence for each finding.",
      },
      {
        lead: 'The plan as a working tracker',
        text: 'The plan as a working tracker: ranked, with owners and estimated effort.',
      },
      {
        lead: 'Your data back',
        text: 'Your data back, and deleted on my side when the work ends.',
      },
    ],
  },
] satisfies ReviewColumn[];
