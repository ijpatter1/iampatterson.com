import { CONTACT_CONFIG } from './config';
import type { Inquiry } from './validate';

/** Removes anything that could end a header line. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** RFC 2047 encoding for a header value that is not plain ASCII. */
function encodeHeader(value: string): string {
  const safe = headerSafe(value);
  return /^[\x20-\x7e]*$/.test(safe)
    ? safe
    : `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`;
}

function displayName(name: string): string {
  return encodeHeader(name).replace(/["\\]/g, '');
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
    `Reply-To: "${displayName(inquiry.name)}" <${headerSafe(inquiry.email)}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    `Name: ${headerSafe(inquiry.name)}`,
    `Email: ${headerSafe(inquiry.email)}`,
    '',
    inquiry.message + sessionSection(inquiry.sessionState),
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gmailToken}` },
    body: JSON.stringify({ raw: buildRawMessage(inquiry) }),
  });
  if (!res.ok) throw new Error(`gmail send failed with HTTP ${res.status}`);
}
