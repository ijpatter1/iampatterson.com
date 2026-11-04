import { REVIEW_PRICE } from '@/lib/content/review';
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
}

export const CONTACT_INTROS: Record<ContactIntent, ContactIntro> = {
  default: {
    eyebrow: 'Contact',
    title: "Tell me what you're working on.",
    intro:
      "Usually it's paid media data: a weekly report that doesn't reconcile to the ad platforms, tracking nobody trusts, or AI your team wants on top of it. Tell me what you're seeing.",
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
    "I'll respond within 24 hours. If we're a good fit, we'll schedule a 30-minute call to discuss your current setup and goals.",
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
      body: 'The review is read-only. I document what your tracking captures and what it misses, rank what I find by impact, and you decide what to fix.',
    },
    {
      title: 'We agree the measure before the build.',
      body: "Builds have a fixed scope, and before one starts we agree how we'll measure the change it creates.",
    },
    {
      title: 'What I build stays yours.',
      body: 'Your paid media and sales data ends up in accounts you own, every account and asset is in your name, and you get a runbook at handoff. I set the rules for what the AI can see and change, and who signs off on its changes.',
    },
  ] satisfies Principle[],
} as const;

export const CONTACT_METADATA = {
  title: 'Contact',
  description: `Marketing data, measurement and AI for in-house marketing teams. Tell me what you're working on, or book the review, from ${REVIEW_PRICE}.`,
} as const;
