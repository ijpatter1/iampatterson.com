import { ConnectionManager, MAX_CONNECTIONS_PER_SESSION } from './connections';
import type { Response } from 'express';

function mockResponse(): Response {
  const res = {
    writeHead: jest.fn(),
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
    on: jest.fn(),
    headersSent: false,
    writableEnded: false,
  } as unknown as Response;
  return res;
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe('add / remove / get', () => {
    it('adds and retrieves a connection by session ID', () => {
      const res = mockResponse();
      manager.add('sess-1', res);
      expect([...(manager.get('sess-1') ?? [])]).toEqual([res]);
    });

    it('returns undefined for unknown session ID', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    // Two tabs on one session each hold a connection. A second connection
    // must not end the first: the visitor is looking at both tabs.
    it('keeps the existing connection when another arrives for the same session', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-1', res2);
      expect(res1.end).not.toHaveBeenCalled();
      expect([...(manager.get('sess-1') ?? [])]).toEqual([res1, res2]);
    });

    // The 2026-10-12 gap: the old tab's close handler removed the session's
    // entry, which by then was the new tab's connection. Removal must take
    // only the response that closed.
    it('removes only the response that closed, leaving the other tab connected', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-1', res2);
      manager.remove('sess-1', res1);
      expect([...(manager.get('sess-1') ?? [])]).toEqual([res2]);
      expect(manager.send('sess-1', { event_name: 'page_view' })).toBe(true);
      expect(res2.write).toHaveBeenCalled();
      expect(res1.write).not.toHaveBeenCalled();
    });

    it('deletes the session once its last connection is removed', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-1', res2);
      manager.remove('sess-1', res1);
      manager.remove('sess-1', res2);
      expect(manager.get('sess-1')).toBeUndefined();
      expect(manager.send('sess-1', { event_name: 'page_view' })).toBe(false);
      expect(manager.size).toBe(0);
    });

    it('ignores removing a response it does not hold', () => {
      const res1 = mockResponse();
      manager.add('sess-1', res1);
      manager.remove('sess-1', mockResponse());
      manager.remove('sess-2', res1);
      expect([...(manager.get('sess-1') ?? [])]).toEqual([res1]);
    });
  });

  // A client that keeps opening connections and never closes them (a bug, or
  // a page left open in many tabs) would otherwise grow one session's set,
  // and the server's memory and open sockets, without limit.
  describe('the per-session cap', () => {
    it(`ends the oldest connection when a session would exceed ${MAX_CONNECTIONS_PER_SESSION}`, () => {
      const responses = Array.from({ length: MAX_CONNECTIONS_PER_SESSION + 1 }, mockResponse);
      responses.forEach((res) => manager.add('sess-1', res));

      const [oldest, ...rest] = responses;
      expect(oldest.end).toHaveBeenCalled();
      rest.forEach((res) => expect(res.end).not.toHaveBeenCalled());
      expect([...(manager.get('sess-1') ?? [])]).toEqual(rest);
      expect(manager.size).toBe(MAX_CONNECTIONS_PER_SESSION);

      manager.send('sess-1', { event_name: 'page_view' });
      expect(oldest.write).not.toHaveBeenCalled();
      rest.forEach((res) => expect(res.write).toHaveBeenCalled());
    });

    // The ended response's close handler still runs later and removes it;
    // that must not disturb the others.
    it("treats the ended connection's later close as a no-op", () => {
      const responses = Array.from({ length: MAX_CONNECTIONS_PER_SESSION + 1 }, mockResponse);
      responses.forEach((res) => manager.add('sess-1', res));
      manager.remove('sess-1', responses[0]);
      expect(manager.size).toBe(MAX_CONNECTIONS_PER_SESSION);
    });

    it('is five', () => {
      expect(MAX_CONNECTIONS_PER_SESSION).toBe(5);
    });
  });

  describe('send', () => {
    it('sends SSE-formatted data to the connection for the given session', () => {
      const res = mockResponse();
      manager.add('sess-1', res);
      const sent = manager.send('sess-1', { event_name: 'page_view' });
      expect(sent).toBe(true);
      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ event_name: 'page_view' })}\n\n`,
      );
    });

    it('sends to every connection the session holds', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-1', res2);
      expect(manager.send('sess-1', { event_name: 'page_view' })).toBe(true);
      const line = `data: ${JSON.stringify({ event_name: 'page_view' })}\n\n`;
      expect(res1.write).toHaveBeenCalledWith(line);
      expect(res2.write).toHaveBeenCalledWith(line);
    });

    it('returns false when session has no connection', () => {
      const sent = manager.send('nonexistent', { foo: 'bar' });
      expect(sent).toBe(false);
    });
  });

  describe('size', () => {
    it('returns 0 for empty manager', () => {
      expect(manager.size).toBe(0);
    });

    it('returns the number of active connections', () => {
      manager.add('sess-1', mockResponse());
      manager.add('sess-2', mockResponse());
      expect(manager.size).toBe(2);
    });

    // /health reports this as `connections`: open SSE responses, not sessions.
    it('counts every open connection, including two on one session', () => {
      manager.add('sess-1', mockResponse());
      manager.add('sess-1', mockResponse());
      manager.add('sess-2', mockResponse());
      expect(manager.size).toBe(3);
    });

    it('decrements after removal', () => {
      const res1 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-2', mockResponse());
      manager.remove('sess-1', res1);
      expect(manager.size).toBe(1);
    });
  });

  describe('broadcast', () => {
    it('sends data to all connections', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-2', res2);
      const res3 = mockResponse();
      manager.add('sess-2', res3);
      manager.broadcast({ type: 'heartbeat' });
      expect(res1.write).toHaveBeenCalled();
      expect(res2.write).toHaveBeenCalled();
      expect(res3.write).toHaveBeenCalled();
    });
  });
});
