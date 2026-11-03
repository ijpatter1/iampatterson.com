/**
 * @jest-environment node
 */

const mockGetServiceAccountToken = jest.fn();
const mockGetGmailToken = jest.fn();
const mockAssessToken = jest.fn();
const mockSendMessage = jest.fn();

jest.mock('@/lib/contact/google', () => ({
  getServiceAccountToken: (...a: unknown[]) => mockGetServiceAccountToken(...a),
  getGmailToken: (...a: unknown[]) => mockGetGmailToken(...a),
}));
jest.mock('@/lib/contact/recaptcha', () => ({
  RECAPTCHA_MIN_SCORE: 0.5,
  assessToken: (...a: unknown[]) => mockAssessToken(...a),
}));
jest.mock('@/lib/contact/gmail', () => ({
  sendMessage: (...a: unknown[]) => mockSendMessage(...a),
}));

import { POST } from '@/app/api/contact/route';

const MESSAGE = 'Our ad platform and our warehouse disagree on conversions';
const inquiry = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: MESSAGE,
  token: 'recaptcha-token',
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request('https://www.iampatterson.com/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

let logged: string[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockGetServiceAccountToken.mockResolvedValue('sa-token');
  mockGetGmailToken.mockResolvedValue('gmail-token');
  mockAssessToken.mockResolvedValue({ ok: true, score: 0.9 });
  mockSendMessage.mockResolvedValue(undefined);
  logged = [];
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});
afterEach(() => jest.restoreAllMocks());

describe('POST /api/contact', () => {
  it('sends a verified inquiry and answers 200', async () => {
    const res = await post(inquiry);
    expect(res.status).toBe(200);
    expect(mockAssessToken).toHaveBeenCalledWith('recaptcha-token', 'sa-token');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ada Lovelace', email: 'ada@example.com', message: MESSAGE }),
      'gmail-token',
    );
  });

  it('rejects an invalid inquiry with 400 before calling Google', async () => {
    const res = await post({ ...inquiry, email: 'nope' });
    expect(res.status).toBe(400);
    expect(mockGetServiceAccountToken).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON with 400', async () => {
    expect((await post('name=Ada')).status).toBe(400);
  });

  it('rejects an oversized body with 413 without reading it', async () => {
    const res = await post(inquiry, { 'content-length': '200000' });
    expect(res.status).toBe(413);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  // A low score or a bad token means nothing is sent: the spam check is the
  // gate, not advice.
  it('sends nothing and answers 403 when reCAPTCHA refuses the token', async () => {
    mockAssessToken.mockResolvedValue({ ok: false, score: 0.1, reason: 'low_score' });
    const res = await post(inquiry);
    expect(res.status).toBe(403);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('answers 502 when delivery fails, so the form can say so', async () => {
    mockSendMessage.mockRejectedValue(new Error('gmail 500'));
    expect((await post(inquiry)).status).toBe(502);
  });

  // Preview cannot run this path, so the production log is the only place a
  // failed first submission can be diagnosed: it names the step and status.
  it('logs the failing step and its HTTP status', async () => {
    mockGetServiceAccountToken.mockRejectedValue(new Error('sts failed with HTTP 403'));
    await post(inquiry);
    expect(logged.join('\n')).toContain('"step":"sts","status":403');
  });

  it('answers 502 when Google sign-in fails', async () => {
    mockGetServiceAccountToken.mockRejectedValue(new Error('sts 403'));
    expect((await post(inquiry)).status).toBe(502);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  // The project rule: no input text in logs. Each outcome is logged, and none
  // of the visitor's name, address or message appears in any line.
  it.each([
    ['a sent inquiry', () => undefined],
    [
      'a refused token',
      () => mockAssessToken.mockResolvedValue({ ok: false, score: 0.1, reason: 'low_score' }),
    ],
    [
      'a failed delivery',
      () => mockSendMessage.mockRejectedValue(new Error(`gmail rejected ${MESSAGE}`)),
    ],
  ])('logs %s without any of the visitor’s text', async (_label, arrange) => {
    arrange();
    await post(inquiry);
    expect(logged.length).toBeGreaterThan(0);
    const all = logged.join('\n');
    expect(all).not.toContain('Ada');
    expect(all).not.toContain('ada@example.com');
    expect(all).not.toContain('warehouse disagree');
  });
});
