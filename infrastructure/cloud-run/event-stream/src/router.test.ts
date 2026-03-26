import { parsePubSubMessage, routeMessage } from './router';
import { ConnectionManager } from './connections';
import type { Response } from 'express';

function mockResponse(): Response {
  return {
    writeHead: jest.fn(),
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
    on: jest.fn(),
    headersSent: false,
    writableEnded: false,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// parsePubSubMessage
// ---------------------------------------------------------------------------

describe('parsePubSubMessage', () => {
  it('decodes a base64-encoded Pub/Sub push message', () => {
    const payload = { session_id: 'sess-1', event_name: 'page_view' };
    const body = {
      message: {
        data: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    };
    const result = parsePubSubMessage(body);
    expect(result).toEqual(payload);
  });

  it('returns null for missing message', () => {
    expect(parsePubSubMessage({})).toBeNull();
  });

  it('returns null for missing data field', () => {
    expect(parsePubSubMessage({ message: {} })).toBeNull();
  });

  it('returns null for invalid base64', () => {
    expect(parsePubSubMessage({ message: { data: '!!invalid!!' } })).toBeNull();
  });

  it('returns null for non-JSON payload', () => {
    const body = {
      message: {
        data: Buffer.from('not json').toString('base64'),
      },
    };
    expect(parsePubSubMessage(body)).toBeNull();
  });

  it('returns null when decoded JSON has no session_id', () => {
    const body = {
      message: {
        data: Buffer.from(JSON.stringify({ event_name: 'page_view' })).toString('base64'),
      },
    };
    expect(parsePubSubMessage(body)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// routeMessage
// ---------------------------------------------------------------------------

describe('routeMessage', () => {
  it('sends the payload to the correct session connection', () => {
    const manager = new ConnectionManager();
    const res = mockResponse();
    manager.add('sess-1', res);

    const payload = { session_id: 'sess-1', event_name: 'page_view' };
    const routed = routeMessage(manager, payload);

    expect(routed).toBe(true);
    expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify(payload)}\n\n`);
  });

  it('returns false when no matching connection exists', () => {
    const manager = new ConnectionManager();
    const payload = { session_id: 'sess-unknown', event_name: 'page_view' };
    expect(routeMessage(manager, payload)).toBe(false);
  });

  it('routes to the correct session among multiple connections', () => {
    const manager = new ConnectionManager();
    const res1 = mockResponse();
    const res2 = mockResponse();
    manager.add('sess-1', res1);
    manager.add('sess-2', res2);

    const payload = { session_id: 'sess-2', event_name: 'click_cta' };
    routeMessage(manager, payload);

    expect(res1.write).not.toHaveBeenCalled();
    expect(res2.write).toHaveBeenCalled();
  });
});
