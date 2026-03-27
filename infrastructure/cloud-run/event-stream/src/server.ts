import express from 'express';

import { ConnectionManager } from './connections';
import { parsePubSubMessage, routeMessage } from './router';

const app = express();
const manager = new ConnectionManager();

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ?? 'https://iampatterson-com.vercel.app,https://iampatterson.com'
).split(',');
const HEARTBEAT_INTERVAL_MS = 30_000;

app.use(express.json());

/** CORS preflight for cross-origin SSE connections (Vercel → Cloud Run). */
app.options('/events', (req, res) => {
  const origin = req.headers.origin ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.writeHead(204, {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  res.end();
});

/**
 * SSE endpoint — browser clients connect here scoped by session ID.
 * GET /events?session_id=<uuid>
 */
app.get('/events', (req, res) => {
  const sessionId = req.query.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    res.status(400).json({ error: 'session_id query parameter required' });
    return;
  }

  const origin = req.headers.origin ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': allowOrigin,
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', session_id: sessionId })}\n\n`);

  manager.add(sessionId, res);

  // Keepalive to prevent Cloud Run / load balancer idle timeout
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    manager.remove(sessionId);
  });
});

/**
 * Pub/Sub push endpoint — receives events from sGTM via Pub/Sub.
 * POST /pubsub/push
 *
 * In production, this endpoint should verify the Pub/Sub OIDC JWT
 * in the Authorization header. Configure the push subscription with
 * a service account and verify the token audience matches this service.
 * See: https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
 */
app.post('/pubsub/push', (req, res) => {
  const payload = parsePubSubMessage(req.body);
  if (!payload) {
    res.status(400).json({ error: 'Invalid Pub/Sub message' });
    return;
  }

  const delivered = routeMessage(manager, payload);
  res.status(200).json({ delivered });
});

/** Health check for Cloud Run. */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    connections: manager.size,
  });
});

const PORT = parseInt(process.env.PORT ?? '8080', 10);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Event stream service listening on port ${PORT}`);
  });
}

export { app, manager };
