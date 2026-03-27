import { ConnectionManager } from './connections';
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
      expect(manager.get('sess-1')).toBe(res);
    });

    it('returns undefined for unknown session ID', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('removes a connection', () => {
      const res = mockResponse();
      manager.add('sess-1', res);
      manager.remove('sess-1');
      expect(manager.get('sess-1')).toBeUndefined();
    });

    it('replaces an existing connection for the same session ID', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-1', res2);
      expect(manager.get('sess-1')).toBe(res2);
    });

    it('closes the old connection when replacing', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-1', res2);
      expect(res1.end).toHaveBeenCalled();
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

    it('decrements after removal', () => {
      manager.add('sess-1', mockResponse());
      manager.add('sess-2', mockResponse());
      manager.remove('sess-1');
      expect(manager.size).toBe(1);
    });
  });

  describe('broadcast', () => {
    it('sends data to all connections', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      manager.add('sess-1', res1);
      manager.add('sess-2', res2);
      manager.broadcast({ type: 'heartbeat' });
      expect(res1.write).toHaveBeenCalled();
      expect(res2.write).toHaveBeenCalled();
    });
  });
});
