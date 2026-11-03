import { CONTACT_CONFIG } from './config';

import type { Inquiry } from './validate';

/** Removes anything that could end a header line. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/**
 * RFC 2047 encoding for a header value that is not plain ASCII: one or more
 * encoded-words of at most 75 characters each, folded onto continuation lines.
 * Characters are never split across words.
 */
function encodeHeader(value: string): string {
  const safe = headerSafe(value);
  if (PRINTABLE_ASCII.test(safe)) return safe;
  const words: string[] = [];
  let chunk = '';
  for (const ch of safe) {
    // 45 bytes of UTF-8 become 60 base64 characters: 10 + 60 + 2 = 72 ≤ 75.
    if (Buffer.byteLength(chunk + ch, 'utf8') > 45) {
      words.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join('\r\n ');
}

/**
 * A display name for a header: quoted when it is plain ASCII, encoded-words
 * otherwise (RFC 2047 §5 forbids quoting one). The choice depends on whether
 * the name needed encoding, never on how it starts, so a visitor cannot pass
 * text that merely looks encoded straight into the address list.
 */
function displayName(name: string): string {
  const safe = headerSafe(name);
  return PRINTABLE_ASCII.test(safe) ? `"${safe.replace(/["\\]/g, '')}"` : encodeHeader(safe);
}

/** Base64 in 76-character lines, so no line can exceed the 998-octet limit. */
function base64Body(text: string): string {
  const crlf = text.replace(/\r?\n/g, '\r\n');
  return (
    Buffer.from(crlf, 'utf8')
      .toString('base64')
      .match(/.{1,76}/g) ?? []
  ).join('\r\n');
}

function sessionSection(sessionState: string | undefined): string {
  if (!sessionState) return '';
  let pretty = sessionState;
  try {
    pretty = JSON.stringify(JSON.parse(sessionState), null, 2);
  } catch {
    // Not JSON: include it as sent.
  }
  return `\n\n--\nSession the visitor chose to share:\n${pretty}\n`;
}

/** The inquiry as a MIME message, base64url-encoded for the Gmail API. */
export function buildRawMessage(inquiry: Inquiry): string {
  const subject = encodeHeader(`Inquiry from ${inquiry.name} via iampatterson.com`);
  const lines = [
    `From: "iampatterson.com contact form" <${CONTACT_CONFIG.mailbox}>`,
    `To: ${CONTACT_CONFIG.mailbox}`,
    `Reply-To: ${displayName(inquiry.name)} <${headerSafe(inquiry.email)}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(
      `Name: ${headerSafe(inquiry.name)}\nEmail: ${headerSafe(inquiry.email)}\n\n` +
        inquiry.message +
        sessionSection(inquiry.sessionState),
    ),
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}

/** Sends the inquiry from the mailbox to itself. */
export async function sendMessage(
  inquiry: Inquiry,
  gmailToken: string,
  deps: { fetch?: typeof fetch } = {},
): Promise<void> {
  const doFetch = deps.fetch ?? fetch;
  const res = await doFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    signal: AbortSignal.timeout(CONTACT_CONFIG.googleTimeoutMs),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gmailToken}` },
    body: JSON.stringify({ raw: buildRawMessage(inquiry) }),
  });
  if (!res.ok) throw new Error(`gmail send failed with HTTP ${res.status}`);
}
