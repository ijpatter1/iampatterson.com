/**
 * The review page's copy (15.10), from the LinkedIn profile's Featured item
 * "Start with a review" and its Founder entry, with the October review
 * block's signed columns (REVIEW_COLUMNS in ./review).
 */
import { HOW_WE_WORK, REVIEW_PRICE } from './review';

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
  /** What the starting price covers (Ian, 2026-11-03). */
  scope:
    'That covers one brand: its website, tag manager and analytics, up to four ad platforms and one order system. More of any of them widens the scope, and I confirm the price before we start.',
  /** A turnaround counted from full access, never an effort duration (Ian, 2026-11-03). */
  turnaround: 'About a week, once I have all the required platform and data access.',
  cta: 'Book the review',
  includesEyebrow: 'What it includes',
  /** The areas a real review covered (2026-10), in general terms. */
  includes: [
    'Your conversion definitions and events: what counts as a purchase or a sign-up, and where each one fires.',
    'Tag Manager, web and server, and your analytics with its warehouse export.',
    "Each ad platform's attribution settings, deduplication and click IDs.",
    "Each platform's claims read against your orders: claimed, matched to an order, sold.",
    'How your weekly reporting is built, and who it depends on.',
    'Where your data lives and whose name each account is in: the ad accounts, the tag containers and the warehouse.',
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
      // The homepage ladder's Lead step, word for word, from one place.
      text: HOW_WE_WORK.steps[2].body,
    },
  ] satisfies FollowStep[],
} as const;
