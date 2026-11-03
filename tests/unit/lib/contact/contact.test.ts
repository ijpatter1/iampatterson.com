/**
 * @jest-environment node
 */
import { buildRawMessage } from '@/lib/contact/gmail';
import { assessToken, RECAPTCHA_MIN_SCORE } from '@/lib/contact/recaptcha';
import { getGmailToken, getServiceAccountToken } from '@/lib/contact/google';
import { CONTACT_CONFIG } from '@/lib/contact/config';
import { validateInquiry } from '@/lib/contact/validate';

type Call = { url: string; init: RequestInit };

/** A fetch stand-in that answers each URL in order and records what was sent. */
function fakeFetch(responses: Array<{ match: string; status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {} });
    const next = responses.find((r) => u.includes(r.match));
    if (!next) throw new Error(`unexpected fetch ${u}`);
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const body = (c: Call) => {
  const b = c.init.body;
  return typeof b === 'string' && b.startsWith('{')
    ? JSON.parse(b)
    : new URLSearchParams(String(b));
};

describe('validateInquiry', () => {
  const ok = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Can we talk about our tags?',
    token: 't',
  };

  it('accepts a complete inquiry and trims it', () => {
    const r = validateInquiry({ ...ok, name: '  Ada Lovelace ' });
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ name: 'Ada Lovelace' }) });
  });

  it.each([
    ['a missing name', { ...ok, name: '' }],
    ['an address that is not an email', { ...ok, email: 'not-an-email' }],
    ['an empty message', { ...ok, message: '   ' }],
    ['a message over 5,000 characters', { ...ok, message: 'x'.repeat(5001) }],
    ['a missing reCAPTCHA token', { ...ok, token: '' }],
    ['a name carrying a line break', { ...ok, name: 'Ada\r\nBcc: someone@example.com' }],
  ])('rejects %s', (_label, input) => {
    expect(validateInquiry(input).ok).toBe(false);
  });

  it('rejects a body that is not an object', () => {
    expect(validateInquiry('hello').ok).toBe(false);
  });
});

describe('buildRawMessage', () => {
  const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');
  /** The headers, and the body decoded from its base64 transfer encoding. */
  const parts = (raw: string) => {
    const mime = decode(raw);
    const [headers, ...rest] = mime.split('\r\n\r\n');
    const body = Buffer.from(rest.join('').replace(/\r\n/g, ''), 'base64').toString('utf8');
    return { mime, headers, body };
  };

  it('sends from and to the configured mailbox, with the visitor as Reply-To', () => {
    const { headers: mime, body } = parts(
      buildRawMessage({ name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello there' }),
    );
    expect(mime).toMatch(new RegExp(`^From: .*<${CONTACT_CONFIG.mailbox}>`, 'm'));
    expect(mime).toMatch(new RegExp(`^To: ${CONTACT_CONFIG.mailbox}`, 'm'));
    expect(mime).toMatch(/^Reply-To: .*<ada@example\.com>/m);
    expect(body).toContain('Hello there');
  });

  // The visitor controls the name and the address. Neither can be allowed to
  // start a new header line, or the form becomes a relay.
  it('cannot be made to add a header from the visitor’s input', () => {
    const mime = decode(
      buildRawMessage({ name: 'Ada\nBcc: x@example.com', email: 'ada@example.com', message: 'm' }),
    );
    const headers = mime.split('\r\n\r\n')[0];
    expect(headers).not.toMatch(/^Bcc:/m);
    expect(mime).not.toMatch(/^Bcc:/m);
  });

  it('encodes a non-ASCII subject so mail clients show it intact', () => {
    const mime = decode(buildRawMessage({ name: 'Zoë', email: 'z@example.com', message: 'm' }));
    expect(mime).toMatch(/^Subject: =\?UTF-8\?B\?/m);
  });

  // RFC 5322 caps a line at 998 octets; a long paragraph sent as 8bit would
  // break it. Base64 lines stay short whatever the visitor writes.
  it('keeps every line within the mail line limit for a long message', () => {
    const { mime, body } = parts(
      buildRawMessage({ name: 'Ada', email: 'a@example.com', message: 'word '.repeat(1000) }),
    );
    expect(Math.max(...mime.split('\r\n').map((l) => l.length))).toBeLessThanOrEqual(998);
    expect(body).toContain('word word');
  });

  // An encoded-word inside quotes is shown raw by conforming mail clients.
  it('writes a non-ASCII Reply-To name as an unquoted encoded-word', () => {
    const { headers } = parts(
      buildRawMessage({ name: 'José Müller', email: 'j@example.com', message: 'm' }),
    );
    expect(headers).toMatch(/^Reply-To: =\?UTF-8\?B\?[^"\r\n]+\?= <j@example\.com>$/m);
  });

  it('adds the session summary when the visitor chose to send it', () => {
    const { body: mime } = parts(
      buildRawMessage({
        name: 'Ada',
        email: 'a@example.com',
        message: 'm',
        sessionState: '{"session_id":"abc","pages_visited":3}',
      }),
    );
    expect(mime).toContain('Session the visitor chose to share');
    expect(mime).toContain('"pages_visited": 3');
  });
});

describe('the keyless Google token chain', () => {
  const oidc = async () => 'vercel-oidc-jwt';

  it('exchanges the Vercel token, then impersonates the service account', async () => {
    const { fn, calls } = fakeFetch([
      { match: 'sts.googleapis.com', body: { access_token: 'federated' } },
      { match: ':generateAccessToken', body: { accessToken: 'sa-token' } },
    ]);
    await expect(getServiceAccountToken({ fetch: fn, getOidcToken: oidc })).resolves.toBe(
      'sa-token',
    );
    const sts = body(calls[0]);
    expect(sts.get('subject_token')).toBe('vercel-oidc-jwt');
    expect(sts.get('audience')).toBe(CONTACT_CONFIG.workloadIdentityAudience);
    expect(calls[1].url).toContain(CONTACT_CONFIG.serviceAccount);
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe(
      'Bearer federated',
    );
  });

  // Domain-wide delegation with no stored key: the service account signs the
  // assertion through the IAM Credentials API, naming the mailbox it acts as
  // and asking only to send.
  it('gets a send-only Gmail token for the mailbox through a signed assertion', async () => {
    const { fn, calls } = fakeFetch([
      { match: ':signJwt', body: { signedJwt: 'signed' } },
      { match: 'oauth2.googleapis.com/token', body: { access_token: 'gmail-token' } },
    ]);
    await expect(getGmailToken('sa-token', { fetch: fn })).resolves.toBe('gmail-token');
    const claims = JSON.parse(body(calls[0]).payload);
    expect(claims).toMatchObject({
      iss: CONTACT_CONFIG.serviceAccount,
      sub: CONTACT_CONFIG.mailbox,
      scope: 'https://www.googleapis.com/auth/gmail.send',
    });
    expect(body(calls[1]).get('assertion')).toBe('signed');
  });

  it('fails loudly when a step is refused', async () => {
    const { fn } = fakeFetch([
      { match: 'sts.googleapis.com', status: 403, body: { error: 'denied' } },
    ]);
    await expect(getServiceAccountToken({ fetch: fn, getOidcToken: oidc })).rejects.toThrow(/sts/);
  });
});

describe('assessToken', () => {
  const assessment = (props: Record<string, unknown>, score: number) => ({
    match: 'recaptchaenterprise.googleapis.com',
    body: {
      tokenProperties: {
        valid: true,
        action: 'contact_submit',
        hostname: 'www.iampatterson.com',
        ...props,
      },
      riskAnalysis: { score },
    },
  });

  it('passes a valid token for the contact action with a score at the threshold', async () => {
    const { fn, calls } = fakeFetch([assessment({}, RECAPTCHA_MIN_SCORE)]);
    await expect(assessToken('tok', 'sa-token', { fetch: fn })).resolves.toEqual({
      ok: true,
      score: RECAPTCHA_MIN_SCORE,
    });
    expect(body(calls[0]).event).toMatchObject({
      token: 'tok',
      siteKey: CONTACT_CONFIG.recaptchaSiteKey,
    });
  });

  it.each([
    ['a low score', assessment({}, RECAPTCHA_MIN_SCORE - 0.1)],
    ['an invalid token', assessment({ valid: false, invalidReason: 'EXPIRED' }, 0.9)],
    ['a token minted for another action', assessment({ action: 'login' }, 0.9)],
    ['a token minted on another site', assessment({ hostname: 'attacker.example' }, 0.9)],
  ])('refuses %s', async (_label, response) => {
    const { fn } = fakeFetch([response]);
    await expect(assessToken('tok', 'sa-token', { fetch: fn })).resolves.toMatchObject({
      ok: false,
    });
  });
});
