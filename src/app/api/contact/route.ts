import { getGmailToken, getServiceAccountToken } from '@/lib/contact/google';
import { sendMessage } from '@/lib/contact/gmail';
import { assessToken } from '@/lib/contact/recaptcha';
import { validateInquiry } from '@/lib/contact/validate';

const MAX_BODY_BYTES = 20_000;

/**
 * One line per submission, codes only. The project rule is that no input text
 * reaches a log: no name, address, message or Google error body.
 */
function log(outcome: string, extra: Record<string, string | number | null> = {}) {
  console.log(JSON.stringify({ event: 'contact_submit', outcome, ...extra }));
}

function reply(status: number, error?: string) {
  return Response.json(error ? { ok: false, error } : { ok: true }, { status });
}

/** The failing step and its HTTP status, from our own error text ("sts failed with HTTP 403"). */
function failure(e: unknown): { step: string; status: number | null } {
  if (!(e instanceof Error)) return { step: 'unknown', status: null };
  const status = /HTTP (\d{3})/.exec(e.message);
  return { step: e.message.split(' ')[0].slice(0, 40), status: status ? Number(status[1]) : null };
}

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    log('too_large');
    return reply(413, 'too_large');
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      log('too_large');
      return reply(413, 'too_large');
    }
    body = JSON.parse(text);
  } catch {
    log('bad_json');
    return reply(400, 'invalid');
  }

  const checked = validateInquiry(body);
  if (!checked.ok) {
    log('invalid', { field: checked.field });
    return reply(400, 'invalid');
  }
  const { token, ...inquiry } = checked.value;

  let saToken: string;
  try {
    saToken = await getServiceAccountToken();
  } catch (e) {
    log('auth_failed', failure(e));
    return reply(502, 'unavailable');
  }

  try {
    const assessment = await assessToken(token, saToken);
    if (!assessment.ok) {
      log('refused', { reason: assessment.reason, score: assessment.score });
      return reply(403, 'refused');
    }
    await sendMessage(inquiry, await getGmailToken(saToken));
    log('sent', { score: assessment.score });
    return reply(200);
  } catch (e) {
    log('send_failed', failure(e));
    return reply(502, 'unavailable');
  }
}
