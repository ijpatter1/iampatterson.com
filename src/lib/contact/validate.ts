import { CONTACT_CONFIG } from './config';

/** Why the visitor wrote: `review` from the "Book the review" buttons. */
export type ContactIntent = 'default' | 'review';

/**
 * `review` selects the review heading on /contact and the review subject on
 * the inquiry; anything else, missing or unknown, is the default. Lives with
 * validation so the API route doesn't depend on page copy.
 */
export function contactIntent(value: unknown): ContactIntent {
  return value === 'review' ? 'review' : 'default';
}

export interface Inquiry {
  name: string;
  email: string;
  message: string;
  /** `review` from the "Book the review" buttons, read as the contact page reads it. */
  intent: ContactIntent;
  /** The session summary, when the visitor ticked the box to send it. */
  sessionState?: string;
}

export type ValidationResult =
  | { ok: true; value: Inquiry & { token: string } }
  | { ok: false; field: string };

const LIMITS = { ...CONTACT_CONFIG.limits, sessionState: 4000, token: 4000 } as const;
/**
 * Deliberately loose: the browser's own type="email" check runs first, and the
 * address only has to be good enough to reply to. One "@", no whitespace, and a
 * dot inside the domain. Checked by hand rather than by a regular expression,
 * so no input can make it backtrack.
 */
function looksLikeEmail(email: string): boolean {
  if (/\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}
const LINE_BREAK = /[\r\n]/;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Checks a submitted body. Rejects rather than repairs: a bad field is a 400. */
export function validateInquiry(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') return { ok: false, field: 'body' };
  const raw = input as Record<string, unknown>;
  const name = text(raw.name);
  const email = text(raw.email);
  // Browsers submit textarea line breaks as CRLF but count each as one
  // character against maxLength; normalise so the two limits agree.
  const message = text(raw.message).replace(/\r\n/g, '\n');
  const token = text(raw.token);
  const sessionState = text(raw.session_state ?? raw.sessionState);
  // Never a rejection: a missing or unknown intent is a general inquiry.
  const intent = contactIntent(raw.intent);

  // Name and address end up in mail headers; a line break there would start a
  // header of the visitor's choosing.
  if (!name || name.length > LIMITS.name || LINE_BREAK.test(name))
    return { ok: false, field: 'name' };
  if (email.length > LIMITS.email || !looksLikeEmail(email)) return { ok: false, field: 'email' };
  if (!message || message.length > LIMITS.message) return { ok: false, field: 'message' };
  if (!token || token.length > LIMITS.token) return { ok: false, field: 'token' };
  if (sessionState.length > LIMITS.sessionState) return { ok: false, field: 'session_state' };

  return {
    ok: true,
    value: { name, email, message, intent, token, ...(sessionState ? { sessionState } : {}) },
  };
}
