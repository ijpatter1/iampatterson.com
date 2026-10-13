/** The two-day review's price. One field, so a change is one line. */
export const REVIEW_PRICE = '$2,500';

export interface ReviewColumn {
  label: string;
  text: string;
}

export const REVIEW = {
  eyebrow: 'Start here',
  title: 'The two-day review.',
  body: "Two days, up to twelve hours. I check what your site tracks today, in both consent states, and read each platform's claims against your orders. You get a written findings and fix list, ranked by revenue at stake, and a project quote for the fixes.",
  cta: 'Book the review',
  priceLine: `Fixed price · ${REVIEW_PRICE}`,
  columns: [
    {
      label: 'You give me',
      text: 'Read access to GTM, GA4 and the ad accounts. An order export from your system of record.',
    },
    {
      label: 'You get',
      text: 'The findings and fix list. Three numbers per platform: claimed, verified, sold. A quote for the fixes.',
    },
    {
      label: 'Then',
      text: 'Fixes and builds as scoped projects. Every account and asset in your name. A runbook at handoff.',
    },
  ] satisfies ReviewColumn[],
} as const;
