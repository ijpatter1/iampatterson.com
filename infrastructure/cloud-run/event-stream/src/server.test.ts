import http from 'http';
import { app, manager } from './server';

let server: http.Server;
let baseUrl: string;

beforeAll((done) => {
  server = app.listen(0, () => {
    const addr = server.address();
    if (typeof addr === 'object' && addr) {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
    done();
  });
});

afterAll((done) => {
  // An SSE response stays open until the client goes; close any a failed test left behind.
  server.closeAllConnections();
  server.close(done);
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; connections: number };
    expect(body.status).toBe('ok');
    expect(typeof body.connections).toBe('number');
  });
});

describe('OPTIONS /events (CORS preflight)', () => {
  it('returns 204 with CORS headers', async () => {
    const res = await fetch(`${baseUrl}/events`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://iampatterson-com.vercel.app' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://iampatterson-com.vercel.app',
    );
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
  });
});

describe('GET /events', () => {
  it('returns 400 without session_id', async () => {
    const res = await fetch(`${baseUrl}/events`);
    expect(res.status).toBe(400);
  });

  it('returns SSE headers with valid session_id', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/events?session_id=test-sess`, {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    controller.abort();
  });
});

describe('POST /pubsub/push', () => {
  it('returns 400 for invalid body', async () => {
    const res = await fetch(`${baseUrl}/pubsub/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 with delivered:false when no matching session', async () => {
    const payload = { session_id: 'no-match', event_name: 'page_view' };
    const body = {
      message: {
        data: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    };
    const res = await fetch(`${baseUrl}/pubsub/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    // `res.json()` is `unknown` on this service's own dependency set. It typed
    // as `any` locally only because TypeScript walks up to the repo-root
    // node_modules/@types, which a per-service `npm ci` — CI's, and the
    // Dockerfile's — does not have. First CI run caught it: TS18046.
    const json = (await res.json()) as { delivered: boolean };
    expect(json.delivered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Two tabs on one session
//
// Each tab opens its own stream for the visitor's session. Both must receive
// the session's events, and one tab closing must not take the stream from the
// other. Until this was fixed, the second connection ended the first, and the
// first's close handler then removed the second, leaving it open and silent.
// ---------------------------------------------------------------------------

interface OpenStream {
  controller: AbortController;
  /** Resolves with the stream's text once it contains `needle`, or rejects after a timeout. */
  waitFor: (needle: string) => Promise<string>;
}

const openControllers: AbortController[] = [];

afterEach(() => {
  openControllers.splice(0).forEach((c) => c.abort());
});

async function openStream(sessionId: string): Promise<OpenStream> {
  const controller = new AbortController();
  openControllers.push(controller);
  const res = await fetch(`${baseUrl}/events?session_id=${sessionId}`, {
    signal: controller.signal,
  });
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let text = '';
  let ended = false;
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
    } catch {
      // Aborted by the test.
    }
    ended = true;
  })();
  void pump;

  async function waitFor(needle: string): Promise<string> {
    const deadline = Date.now() + 1000;
    while (!text.includes(needle)) {
      if (ended) throw new Error(`stream ended before "${needle}" arrived`);
      if (Date.now() > deadline) throw new Error(`"${needle}" did not arrive within 1s`);
      await new Promise((r) => setTimeout(r, 10));
    }
    return text;
  }

  return { controller, waitFor };
}

async function push(payload: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${baseUrl}/pubsub/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { data: Buffer.from(JSON.stringify(payload)).toString('base64') },
    }),
  });
  const json = (await res.json()) as { delivered: boolean };
  return json.delivered;
}

async function waitForConnections(count: number): Promise<void> {
  const deadline = Date.now() + 1000;
  while (manager.size !== count) {
    if (Date.now() > deadline)
      throw new Error(`expected ${count} connections, have ${manager.size}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('two tabs on one session', () => {
  it("delivers the session's events to both tabs", async () => {
    const before = manager.size;
    const tabA = await openStream('two-tabs-both');
    await tabA.waitFor('"type":"connected"');
    const tabB = await openStream('two-tabs-both');
    await tabB.waitFor('"type":"connected"');
    await waitForConnections(before + 2);

    expect(await push({ session_id: 'two-tabs-both', event_name: 'page_view' })).toBe(true);
    await expect(tabA.waitFor('page_view')).resolves.toContain('page_view');
    await expect(tabB.waitFor('page_view')).resolves.toContain('page_view');

    tabA.controller.abort();
    tabB.controller.abort();
    await waitForConnections(before);
  });

  it('keeps delivering to the other tab after one tab closes', async () => {
    const before = manager.size;
    const tabA = await openStream('two-tabs-close');
    await tabA.waitFor('"type":"connected"');
    const tabB = await openStream('two-tabs-close');
    await tabB.waitFor('"type":"connected"');

    tabA.controller.abort();
    // Tab A's close handler has run once only tab B is left.
    await waitForConnections(before + 1);

    expect(await push({ session_id: 'two-tabs-close', event_name: 'click_cta' })).toBe(true);
    await expect(tabB.waitFor('click_cta')).resolves.toContain('click_cta');

    tabB.controller.abort();
    await waitForConnections(before);
    expect(manager.get('two-tabs-close')).toBeUndefined();
  });
});
