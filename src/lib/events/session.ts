/** Generate or retrieve a session ID for the current browser session. */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  const key = '_iap_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}
