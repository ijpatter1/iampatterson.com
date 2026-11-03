import { CONTACT_CONFIG } from './config';

export interface Inquiry {
  name: string;
  email: string;
  message: string;
  /** The session summary, when the visitor ticked the box to send it. */
  sessionState?: string;
}

export type ValidationResult =
  | { ok: true; value: Inquiry & { token: string } }
  | { ok: false; field: string };

const LIMITS = { ...CONTACT_CONFIG.limits, sessionState: 4000, token: 4000 } as const;
// Deliberately loose: the browser's own type="email" check runs first, and the
// address only has to be good enough to reply to.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

  // Name and address end up in mail headers; a line break there would start a
  // header of the visitor's choosing.
  if (!name || name.length > LIMITS.name || LINE_BREAK.test(name))
    return { ok: false, field: 'name' };
  if (!EMAIL.test(email) || email.length > LIMITS.email) return { ok: false, field: 'email' };
  if (!message || message.length > LIMITS.message) return { ok: false, field: 'message' };
  if (!token || token.length > LIMITS.token) return { ok: false, field: 'token' };
  if (sessionState.length > LIMITS.sessionState) return { ok: false, field: 'session_state' };

  return {
    ok: true,
    value: { name, email, message, token, ...(sessionState ? { sessionState } : {}) },
  };
}
