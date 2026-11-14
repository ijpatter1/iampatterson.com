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

  // A visitor with more tabs than the cap must not set off a ring: if a new
  // connection ended the oldest, that tab (still alive) would reconnect and
  // end the next, and the tabs would keep cutting each other off. So the
  // newest is refused and the connections already open are left alone.
  describe('the per-session cap', () => {
    function fill(sessionId: string): Response[] {
      const responses = Array.from({ length: MAX_CONNECTIONS_PER_SESSION }, mockResponse);
      responses.forEach((res) => expect(manager.add(sessionId, res)).toBe(true));
      return responses;
    }

    it(`refuses a connection beyond ${MAX_CONNECTIONS_PER_SESSION}, and the open ones keep receiving`, () => {
      const open = fill('sess-1');
      const extra = mockResponse();
      expect(manager.add('sess-1', extra)).toBe(false);

      expect([...(manager.get('sess-1') ?? [])]).toEqual(open);
      expect(manager.size).toBe(MAX_CONNECTIONS_PER_SESSION);
      manager.send('sess-1', { event_name: 'page_view' });
      open.forEach((res) => expect(res.write).toHaveBeenCalled());
      expect(extra.write).not.toHaveBeenCalled();
    });

    it('never ends an open connection, however many are refused', () => {
      const open = fill('sess-1');
      for (let i = 0; i < 20; i++) manager.add('sess-1', mockResponse());
      open.forEach((res) => expect(res.end).not.toHaveBeenCalled());
    });

    it('accepts a new connection once one of the open ones closes', () => {
      const open = fill('sess-1');
      expect(manager.add('sess-1', mockResponse())).toBe(false);
      manager.remove('sess-1', open[0]);
      const next = mockResponse();
      expect(manager.add('sess-1', next)).toBe(true);
      expect(manager.get('sess-1')?.has(next)).toBe(true);
    });

    it('is per session: another session is not affected', () => {
      fill('sess-1');
      expect(manager.add('sess-2', mockResponse())).toBe(true);
    });

    it('is five', () => {
      expect(MAX_CONNECTIONS_PER_SESSION).toBe(5);
    });
  });

  // /health reports size; a response added twice is still one connection.
  it('counts a response added twice once', () => {
    const res = mockResponse();
    manager.add('sess-1', res);
    manager.add('sess-1', res);
    expect(manager.size).toBe(1);
    manager.remove('sess-1', res);
    expect(manager.size).toBe(0);
    expect(manager.get('sess-1')).toBeUndefined();
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
