import type { ConnectionManager } from './connections';

interface PubSubPushBody {
  message?: {
    data?: string;
  };
}

/**
 * Parse a Pub/Sub push message body.
 * Returns the decoded JSON payload, or null if invalid.
 * Requires the payload to contain a session_id string.
 */
export function parsePubSubMessage(
  body: unknown,
): Record<string, unknown> | null {
  const typed = body as PubSubPushBody;
  const data = typed?.message?.data;
  if (typeof data !== 'string') return null;

  let decoded: string;
  try {
    decoded = Buffer.from(data, 'base64').toString('utf-8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.session_id !== 'string') return null;

  return obj;
}

/**
 * Route a parsed event payload to the matching session's SSE connection.
 * Returns true if the message was delivered.
 */
export function routeMessage(
  manager: ConnectionManager,
  payload: Record<string, unknown>,
): boolean {
  const sessionId = payload.session_id as string;
  return manager.send(sessionId, payload);
}
