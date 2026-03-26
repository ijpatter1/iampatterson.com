import express from 'express';

import { ConnectionManager } from './connections';
import { parsePubSubMessage, routeMessage } from './router';

const app = express();
const manager = new ConnectionManager();

app.use(express.json());

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

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', session_id: sessionId })}\n\n`);

  manager.add(sessionId, res);

  req.on('close', () => {
    manager.remove(sessionId);
  });
});

/**
 * Pub/Sub push endpoint — receives events from sGTM via Pub/Sub.
 * POST /pubsub/push
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
