import type { Response } from 'express';

/**
 * Most open connections one session may hold. Each tab a visitor has open on
 * the site holds one, so a few is normal. Without a cap, a client that keeps
 * opening connections and never closes them would grow its session's set, and
 * the server's memory and open sockets, without limit. When a new connection
 * would exceed the cap, the oldest is ended: it is the one most likely to
 * belong to a tab the visitor has left.
 */
export const MAX_CONNECTIONS_PER_SESSION = 5;

/**
 * Manages SSE connections keyed by session ID. A session holds one connection
 * per open tab, and every event for the session goes to all of them.
 */
export class ConnectionManager {
  /** Insertion-ordered, so the first entry of a set is the oldest connection. */
  private connections = new Map<string, Set<Response>>();
  private count = 0;

  /** Open connections across all sessions (not the number of sessions). */
  get size(): number {
    return this.count;
  }

  add(sessionId: string, res: Response): void {
    let set = this.connections.get(sessionId);
    if (!set) {
      set = new Set();
      this.connections.set(sessionId, set);
    }
    set.add(res);
    this.count++;
    if (set.size > MAX_CONNECTIONS_PER_SESSION) {
      const oldest = set.values().next().value as Response;
      this.remove(sessionId, oldest);
      oldest.end();
    }
  }

  /**
   * Remove one connection. Called from that request's close handler, so it
   * must take only its own response: another tab on the same session may
   * still be open. A response it does not hold (one the cap already ended) is
   * ignored.
   */
  remove(sessionId: string, res: Response): void {
    const set = this.connections.get(sessionId);
    if (!set || !set.delete(res)) return;
    this.count--;
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
