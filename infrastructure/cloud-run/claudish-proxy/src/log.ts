/**
 * claudish-proxy — structured logging with a redaction contract.
 *
 * One JSON object per line to stdout (Cloud Run ingests it). The field
 * allowlist is the privacy boundary: input text, output text,
 * stop_details.explanation (it can quote the input), cache-key
 * preimages, and raw SDK error messages (they can embed the request
 * body) must NEVER appear. redactError() is the only sanctioned way to
 * log an error: constructor name + HTTP status, nothing else.
 * Enforced by test, not discipline: log.test.ts replays real payloads
 * through every path and greps captured stdout for the forbidden text.
 */
import { createHash, randomBytes } from 'node:crypto';

const ALLOWED_FIELDS = new Set([
  'severity',
  'event',
  'requestId',
  'direction',
  'lane',
  'cached',
  'inputChars',
  'outputChars',
  'inputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
  'loopAttempts',
  'revised',
  'judgeP',
  'judgeActionable',
  'ttftMs',
  'totalMs',
  'stopReason',
  'refusalCategory',
  'httpStatus',
  'rateLimited',
  'ipHash',
  'budgetUsedPct',
  'promptVersion',
  'laneAttempts',
  'errorName',
  'message', // free-form is allowed ONLY for our own literal strings
]);

/** Per-instance random salt: ipHash is non-reversible and non-joinable across restarts. */
const IP_SALT = randomBytes(16).toString('hex');

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex').slice(0, 8);
}

export interface RedactedError {
  errorName: string;
  httpStatus?: number;
}

/** The ONLY way an error reaches a log line. Never err.message, never err.stack. */
export function redactError(err: unknown): RedactedError {
  const name =
    err instanceof Error ? err.constructor.name : typeof err;
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : undefined;
  return Number.isFinite(status)
    ? { errorName: name, httpStatus: status }
    : { errorName: name };
}

export type LogSink = (line: string) => void;

let sink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

/** Test seam: capture emitted lines. */
export function setLogSink(next: LogSink): void {
  sink = next;
}

export function logEvent(
  severity: 'INFO' | 'WARNING' | 'ERROR',
  event: string,
  fields: Record<string, string | number | boolean | undefined> = {}
): void {
  const entry: Record<string, unknown> = { severity, event };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!ALLOWED_FIELDS.has(key)) {
      // A disallowed field is a programming error; drop it loudly rather
      // than leak it quietly.
      entry.droppedFields = `${entry.droppedFields ?? ''}${key},`;
      continue;
    }
    entry[key] = value;
  }
  sink(JSON.stringify(entry));
}
