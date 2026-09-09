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
