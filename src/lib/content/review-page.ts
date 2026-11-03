/**
 * The review page's copy (15.10), from the LinkedIn profile's Featured item
 * "Start with a review" and its Founder entry, with the October review
 * block's signed columns (REVIEW_COLUMNS in ./review).
 */
import { REVIEW_PRICE } from './review';

export interface FollowStep {
  label: string;
  text: string;
}

export const REVIEW_PAGE = {
  eyebrow: 'The review',
  title: 'Start with a review.',
  intro:
    "A paid review, and I make no changes. I look at what your tracking captures and what it misses, check each ad platform's claims against your actual orders, and rank what I find by impact. You decide what to act on.",
  price: `From ${REVIEW_PRICE}`,
  /** A proposal for Ian, 2026-11-03: what the starting price covers. */
  scope:
    'That covers one website, up to three ad platforms and one order system or CRM. More of any of them widens the scope, and I confirm the price before we start.',
  cta: 'Book the review',
  includesEyebrow: 'What it includes',
  includes: [
    'What your tracking sends today, from the browser and the server, in both consent states, and what it misses.',
    "Each ad platform's claims read against your orders: claimed, verified from its own click IDs, sold.",
    'Where your paid media and sales data lives, and whose name each account is in: the ad accounts, the tag containers and the warehouse.',
  ],
  columnsEyebrow: 'What you give me, and what you get',
  followsEyebrow: 'What can follow',
  follows: [
    {
      label: 'Build',
      text: 'A build with a fixed scope: conversions back to the ad platforms with consent, your data in accounts you own, then AI your team can check.',
    },
    {
      label: 'Lead',
      text: 'A retainer, or fractional leadership if nobody on your team owns marketing data, measurement and AI at a senior level.',
    },
  ] satisfies FollowStep[],
} as const;
