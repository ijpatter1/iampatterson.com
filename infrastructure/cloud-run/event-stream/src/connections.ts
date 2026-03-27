import type { Response } from 'express';

/**
 * Manages SSE connections keyed by session ID.
 * Each session ID maps to at most one active SSE response.
 */
export class ConnectionManager {
  private connections = new Map<string, Response>();

  get size(): number {
    return this.connections.size;
  }

  add(sessionId: string, res: Response): void {
    const existing = this.connections.get(sessionId);
    if (existing) {
      existing.end();
    }
    this.connections.set(sessionId, res);
  }

  remove(sessionId: string): void {
    this.connections.delete(sessionId);
  }

  get(sessionId: string): Response | undefined {
    return this.connections.get(sessionId);
  }

  /** Send SSE-formatted data to a specific session. Returns true if delivered. */
  send(sessionId: string, data: unknown): boolean {
    const res = this.connections.get(sessionId);
    if (!res) return false;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  }

  /** Send SSE-formatted data to all connected sessions. */
  broadcast(data: unknown): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of this.connections.values()) {
      res.write(payload);
    }
  }
}
