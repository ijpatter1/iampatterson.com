/**
 * @jest-environment node
 */
import { buildRawMessage, sendMessage } from '@/lib/contact/gmail';
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

  // Browsers submit textarea line breaks as CRLF but count each as one
  // character against maxLength. A message the form allowed must pass here.
  it('counts a line break once, as the form does', () => {
    const lines = Array.from({ length: 60 }, () => 'x'.repeat(82)).join('\r\n');
    expect(lines.replace(/\r\n/g, '\n').length).toBeLessThanOrEqual(5000);
    expect(lines.length).toBeGreaterThan(5000);
    expect(validateInquiry({ ...ok, message: lines }).ok).toBe(true);
  });

  // CodeQL flagged the old pattern as backtracking on input like "!@!." with
  // many repeats of "!.". The hand check answers in linear time.
  it('answers at once for an address built to make a regex backtrack', () => {
    const hostile = '!@!.' + '!.'.repeat(100_000);
    const start = Date.now();
    expect(validateInquiry({ ...ok, email: hostile }).ok).toBe(false);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it.each(['a@b.co', 'first.last+tag@sub.example.org'])('accepts %s', (email) => {
    expect(validateInquiry({ ...ok, email }).ok).toBe(true);
  });

  it.each(['a@b', '@b.co', 'a@@b.co', 'a@b.', 'a b@c.co'])('rejects %s', (email) => {
    expect(validateInquiry({ ...ok, email }).ok).toBe(false);
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

  // Mail clients decode an encoded-word wherever it appears in Subject. One
  // typed by the visitor must be encoded again, not passed through.
  it('encodes a subject whose ASCII name contains an encoded-word', () => {
    const { headers } = parts(
      buildRawMessage({ name: '=?UTF-8?B?SGk=?=', email: 'a@example.com', message: 'm' }),
    );
    const subject = headers.split('\r\n').find((l) => l.startsWith('Subject:')) ?? '';
    expect(subject).not.toContain('=?UTF-8?B?SGk=?=');
    expect(subject).toMatch(/^Subject: =\?UTF-8\?B\?/);
  });

  // A plain-ASCII name that merely looks encoded must still be quoted, or its
  // commas and angle brackets become extra addresses.
  it('quotes an ASCII name that looks like an encoded-word', () => {
    const { headers } = parts(
      buildRawMessage({ name: '=?x, Bob <v@other.example>', email: 'a@example.com', message: 'm' }),
    );
    expect(headers).toMatch(/^Reply-To: "=\?x, Bob <v@other\.example>" <a@example\.com>$/m);
  });

  // RFC 2047 caps an encoded-word at 75 characters; longer ones are left
  // undecoded by strict clients.
  it('splits a long non-ASCII name into encoded-words of at most 75 characters', () => {
    const name = 'Zoë Müller-Lüdenscheidt '.repeat(5).trim();
    const { headers } = parts(buildRawMessage({ name, email: 'z@example.com', message: 'm' }));
    const words = headers.match(/=\?UTF-8\?B\?[^?]*\?=/g) ?? [];
    expect(words.length).toBeGreaterThan(2);
    expect(Math.max(...words.map((x) => x.length))).toBeLessThanOrEqual(75);
    expect(Math.max(...headers.split('\r\n').map((l) => l.length))).toBeLessThanOrEqual(998);
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

describe('sendMessage', () => {
  // Cutting off a send Google has already accepted would tell the visitor it
  // failed while the mail arrives, and they would send it again.
  it('sends with no deadline of its own', async () => {
    const { fn, calls } = fakeFetch([{ match: 'gmail.googleapis.com', body: { id: 'm1' } }]);
    await sendMessage({ name: 'Ada', email: 'a@example.com', message: 'm' }, 'gmail-token', {
      fetch: fn,
    });
    expect(calls[0].init.signal).toBeUndefined();
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
    // Every Google call has its own deadline, so the route answers before the
    // form gives up and an inquiry shown as failed cannot arrive later.
    for (const c of calls) expect(c.init.signal).toBeInstanceOf(AbortSignal);
  });

  // Domain-wide delegation with no stored key: the service account signs the
  // assertion through the IAM Credentials API, naming the mailbox it acts as
  // and asking only to send.
  it('gets a send-only Gmail token for the mailbox through a signed assertion', async () => {
    const { fn, calls } = fakeFetch([
      { match: ':signJwt', body: { signedJwt: 'signed' } },
      { match: 'oauth2.googleapis.com/token', body: { access_token: 'gmail-token' } },
    ]);
    await expect(
      getGmailToken('sa-token', { fetch: fn, delegatedUser: 'owner@example.com' }),
    ).resolves.toBe('gmail-token');
    const claims = JSON.parse(body(calls[0]).payload);
    expect(claims).toMatchObject({
      iss: CONTACT_CONFIG.serviceAccount,
      sub: 'owner@example.com',
      scope: 'https://www.googleapis.com/auth/gmail.send',
    });
    expect(body(calls[1]).get('assertion')).toBe('signed');
  });

  // The log must say which call stalled; a raw timeout's message would name
  // none ("The operation was aborted…").
  it('names the step when a call times out', async () => {
    const timeout = jest.fn(async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      });
    }) as unknown as typeof fetch;
    await expect(getServiceAccountToken({ fetch: timeout, getOidcToken: oidc })).rejects.toThrow(
      /^sts timed out$/,
    );
  });

  // The delegated user is deployment configuration, not code.
  it('refuses to sign without the delegated user configured', async () => {
    const { fn } = fakeFetch([]);
    const saved = process.env.CONTACT_DELEGATED_USER;
    delete process.env.CONTACT_DELEGATED_USER;
    await expect(getGmailToken('sa-token', { fetch: fn })).rejects.toThrow(
      /CONTACT_DELEGATED_USER/,
    );
    process.env.CONTACT_DELEGATED_USER = saved;
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
