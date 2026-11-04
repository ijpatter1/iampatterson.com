import { REVIEW_PAGE_HREF, REVIEW_PRICE } from '@/lib/content/review';
import { REVIEW_PAGE } from '@/lib/content/review-page';

/**
 * The contact page, with the about page folded in (16.2). The copy follows
 * the LinkedIn profile of 2026-11-02 (15.9): the heading and intro change
 * with the visitor's intent, and the three principles restate the profile's
 * review, build and ownership lines.
 */

export type ContactIntent = 'default' | 'review';

export interface ContactIntro {
  eyebrow: string;
  title: string;
  intro: string;
  /** A fact line under the intro: the review's price and turnaround. */
  facts?: string;
  /** A pointer to the review page, for visitors who haven't decided on it. */
  reviewLink?: { lead: string; text: string; href: string };
}

export const CONTACT_INTROS: Record<ContactIntent, ContactIntro> = {
  default: {
    eyebrow: 'Contact',
    title: "Tell me where your numbers don't add up.",
    intro:
      "Usually it's one of three things: the ad platforms and your orders don't agree, a site or platform change broke your tracking, or nobody on your team owns the data and every question waits on someone else. Tell me what you're seeing, and I'll tell you whether the review is the right first step.",
    reviewLink: {
      lead: `Start with the review, from ${REVIEW_PRICE}.`,
      text: 'What it includes',
      href: REVIEW_PAGE_HREF,
    },
  },
  review: {
    eyebrow: 'The review',
    title: 'Book the review.',
    intro:
      'Tell me about the brand: its website, the ad platforms you buy on, and where your orders live. I confirm the scope and price before we start.',
    facts: `${REVIEW_PAGE.price} · ${REVIEW_PAGE.turnaround}`,
  },
};

/** `?intent=review` selects the review heading; anything else is the default. */
export function contactIntent(value: string | string[] | undefined): ContactIntent {
  return value === 'review' ? 'review' : 'default';
}

export const CONTACT_EMAIL = 'ian@iampatterson.com';

export const CONTACT_COPY = {
  emailLabel: 'Email',
  response:
    "I reply within 24 hours. If I can help, we'll book a 30-minute call and look at the numbers together. If I can't, I'll tell you.",
  messageHint:
    "Helpful to include: the ad platforms you buy on, where your orders live, and the number you don't trust.",
  formTitle: 'Send a message',
  submit: 'Send message',
  sending: 'Sending…',
  failed: "Your message didn't send. Please email me at",
} as const;

export interface Principle {
  title: string;
  body: string;
}

export const PRINCIPLES = {
  eyebrow: 'How I work',
  items: [
    {
      title: 'I look before I change anything.',
      body: "The review comes first, and it's read-only. I document what your tracking captures and what it misses, rank what I find by impact, and you decide what gets fixed and who fixes it.",
    },
    {
      title: "You'll know whether it worked.",
      body: "Builds have a fixed scope, and before one starts we agree how we'll measure the change it makes.",
    },
    {
      title: 'What I build stays yours.',
      body: 'The warehouse, the server container and the reports sit in accounts in your name, and you get a runbook at handoff. If we stop working together, it all keeps running.',
    },
  ] satisfies Principle[],
} as const;

export const CONTACT_METADATA = {
  title: 'Contact',
  description: `Marketing data, measurement and AI for in-house marketing teams. Tell me where your numbers don't add up, or book the review, from ${REVIEW_PRICE}.`,
} as const;
