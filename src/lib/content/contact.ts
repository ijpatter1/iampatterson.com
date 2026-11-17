import { CONTACT_CONFIG } from '@/lib/contact/config';
import type { ContactIntent } from '@/lib/contact/validate';
import { DONE_WHERE } from '@/lib/content/done-where';
import { REVIEW_PAGE_HREF, REVIEW_PRICE } from '@/lib/content/review';
import { REVIEW_PAGE } from '@/lib/content/review-page';

/**
 * The contact page, with the about page folded in (16.2). The copy follows
 * the LinkedIn profile of 2026-11-02 (15.9): the heading and intro change
 * with the visitor's intent, and the three principles restate the profile's
 * review, build and ownership lines.
 */

export interface ContactIntro {
  eyebrow: string;
  title: string;
  intro: string;
  /** The review's price and turnaround, each exactly as /review states it. */
  price?: string;
  turnaround?: string;
  /** A pointer to the review page, for visitors who haven't decided on it. */
  reviewLink?: { lead: string; text: string; href: string };
}

export const CONTACT_INTROS: Record<ContactIntent, ContactIntro> = {
  default: {
    eyebrow: 'Contact',
    title: "Tell me where your numbers don't add up.",
    intro:
      "Usually it's one of three things: the ad platforms and your orders don't agree, a site or platform change broke your tracking, or nobody on your team owns the data and every question waits on someone else. Describe what you're seeing, and I'll tell you whether the review is the right first step.",
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
    price: REVIEW_PAGE.price,
    turnaround: REVIEW_PAGE.turnaround,
  },
};

/** The public address, from the form's delivery config so the two can't drift. */
export const CONTACT_EMAIL = CONTACT_CONFIG.mailbox;

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

/** Each principle's card icon (21.2): an eye, a tick, a padlock. */
export type PrincipleIcon = 'look' | 'measure' | 'own';

export interface Principle {
  title: string;
  body: string;
  icon: PrincipleIcon;
}

export const PRINCIPLES = {
  title: 'How I work',
  items: [
    {
      icon: 'look',
      title: 'I look before I change anything.',
      body: "The review comes first, and it's read-only. I document what your tracking captures and what it misses, rank what I find by impact, and you decide what gets fixed and who fixes it.",
    },
    {
      icon: 'measure',
      title: "You'll know whether it worked.",
      body: "Builds have a fixed scope, and before one starts we agree how we'll measure the change it makes.",
    },
    {
      icon: 'own',
      title: 'What I build stays yours.',
      body: 'The warehouse, the server container and the reports sit in accounts in your name, and you get a runbook at handoff. If we stop working together, it all keeps running.',
    },
  ] satisfies Principle[],
} as const;

/**
 * "Where I've done it", cut to the names with their years or role (21.2).
 * The full cards stay on the homepage; this reads them, so the two pages
 * can't disagree on a name or a date.
 */
export const CONTACT_DONE_WHERE = {
  title: DONE_WHERE.eyebrow,
  names: DONE_WHERE.cards.map(({ name, when }) => ({ name, when })),
} as const;

/** /contact/thanks: its own metadata, so it never borrows the contact page's. */
export const THANKS_METADATA = {
  title: 'Message sent',
  description: 'Thanks for reaching out. I reply within 24 hours.',
} as const;

export const CONTACT_METADATA = {
  title: 'Contact',
  description: `Marketing data, measurement and AI for in-house marketing teams. Tell me where your numbers don't add up, or book the review, from ${REVIEW_PRICE}.`,
} as const;
