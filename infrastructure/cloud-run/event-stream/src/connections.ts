import type { Response } from 'express';

/**
 * Most open connections one session may hold. Each tab a visitor has open on
 * the site holds one, so a few is normal. Without a cap, a client that keeps
 * opening connections on one session would grow that session's set without
 * limit. The cap does not bound the total: the client picks the session ID,
 * so it can open more under other IDs. There is no global cap.
 *
 * Above the cap the newest connection is refused and the open ones are left
 * alone. Ending the oldest instead would start a ring: that tab is alive, so
 * it reconnects and ends the next, and the tabs keep cutting each other off.
 * A visitor with six or more tabs on the site sees the live stream in five of
 * them. In each tab beyond five, the stream is refused on every retry and the
 * proof panel shows its stream note; that tab stays that way after another
 * tab closes, until it is reloaded or the browser comes back online.
 */
export const MAX_CONNECTIONS_PER_SESSION = 5;

/**
 * Manages SSE connections keyed by session ID. A session holds one connection
 * per open tab, and every event for the session goes to all of them.
 */
export class ConnectionManager {
  private connections = new Map<string, Set<Response>>();

  /** Open connections across all sessions (not the number of sessions). */
  get size(): number {
    let total = 0;
    for (const set of this.connections.values()) total += set.size;
    return total;
  }

  /**
   * Register a connection. Returns false, registering nothing, when the
   * session already holds `MAX_CONNECTIONS_PER_SESSION`; the caller refuses
   * the request. Adding a response the session already holds is a no-op.
   */
  add(sessionId: string, res: Response): boolean {
    const set = this.connections.get(sessionId) ?? new Set<Response>();
    if (set.has(res)) return true;
    if (set.size >= MAX_CONNECTIONS_PER_SESSION) return false;
    set.add(res);
    this.connections.set(sessionId, set);
    return true;
  }

  /**
   * Remove one connection. Called from that request's close handler, so it
   * must take only its own response: another tab on the same session may
   * still be open. A response it does not hold is ignored.
   */
  remove(sessionId: string, res: Response): void {
    const set = this.connections.get(sessionId);
    if (!set || !set.delete(res)) return;
    if (set.size === 0) this.connections.delete(sessionId);
  }

  get(sessionId: string): ReadonlySet<Response> | undefined {
    return this.connections.get(sessionId);
  }

  /** Send SSE-formatted data to every connection a session holds. Returns true if delivered. */
  send(sessionId: string, data: unknown): boolean {
    const set = this.connections.get(sessionId);
    if (!set) return false;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of set) res.write(payload);
    return true;
  }

  /** Send SSE-formatted data to all connected sessions. */
  broadcast(data: unknown): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const set of this.connections.values()) {
      for (const res of set) res.write(payload);
    }
  }
}
