/**
 * Express server for the data generator Cloud Run service.
 *
 * Endpoints:
 *   POST /generate          — Generate and send events for a single day
 *   POST /backfill          — Generate and send historical backfill data
 *   GET  /health            — Health check
 *   GET  /stats             — Current generation stats
 *
 * The service can run in two modes:
 *   1. On-demand: triggered via HTTP endpoints (Cloud Scheduler, manual)
 *   2. Continuous: runs an ongoing generation loop (env CONTINUOUS=true)
 */

import express from 'express';

import type { BusinessModel } from './types';
import { createConfig } from './profiles';
import { validateConfig } from './validation';
import { generateDay, streamingBackfill } from './generator';
import { sendEvents, DEFAULT_TRANSPORT_CONFIG } from './transport';
import type { TransportConfig, SendResult } from './transport';
import { insertAdPlatformRecords } from './bq-insert';

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ServerState {
  lastRun: string | null;
  totalEventsGenerated: number;
  totalEventsSent: number;
  totalErrors: number;
  isRunning: boolean;
}

const state: ServerState = {
  lastRun: null,
  totalEventsGenerated: 0,
  totalEventsSent: 0,
  totalErrors: 0,
  isRunning: false,
};

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/stats', (_req, res) => {
  res.json(state);
});

app.post('/generate', async (req, res) => {
  if (state.isRunning) {
    res.status(409).json({ error: 'Generation already in progress' });
    return;
  }

  try {
    state.isRunning = true;
    const model = (req.body?.model as BusinessModel) || 'ecommerce';
    const date = req.body?.date ? new Date(req.body.date as string) : new Date();
    const dryRun = req.body?.dryRun === true;

    const config = createConfig(model, {
      seed: date.getTime(),
    });

    const validation = validateConfig(config);
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid config', details: validation.errors });
      return;
    }

    const result = generateDay(config, date);
    state.totalEventsGenerated += result.stats.totalEvents;

    let sendResult: SendResult | null = null;
    let adInsertResult = null;
    if (!dryRun) {
      const transportConfig = getTransportConfig();
      sendResult = await sendEvents(result.events, transportConfig);
      state.totalEventsSent += sendResult.sent;
      state.totalErrors += sendResult.failed;

      // Insert ad platform records into BigQuery
      if (result.adPlatformRecords.length > 0) {
        adInsertResult = await insertAdPlatformRecords(result.adPlatformRecords);
        state.totalErrors += adInsertResult.failed;
        if (adInsertResult.failed > 0) {
          console.error(
            `[ad-insert] ${adInsertResult.failed}/${result.adPlatformRecords.length} rows failed`,
            { errors: adInsertResult.errors.slice(0, 3) },
          );
        }
      }
    }

    state.lastRun = new Date().toISOString();
    state.isRunning = false;

    res.json({
      success: true,
      model,
      date: date.toISOString().split('T')[0],
      dryRun,
      stats: result.stats,
      sendResult,
      adInsertResult,
    });
  } catch (err) {
    state.isRunning = false;
    state.totalErrors++;
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/backfill', async (req, res) => {
  if (state.isRunning) {
    res.status(409).json({ error: 'Generation already in progress' });
    return;
  }

  try {
    state.isRunning = true;
    const model = (req.body?.model as BusinessModel) || 'ecommerce';
    const months = (req.body?.months as number) || 18;
    const dryRun = req.body?.dryRun === true;
    const endDate = req.body?.endDate ? new Date(req.body.endDate as string) : new Date();

    const config = createConfig(model, {
      backfillMonths: months,
      seed: endDate.getTime(),
    });

    const validation = validateConfig(config);
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid config', details: validation.errors });
      return;
    }

    const transportConfig = getTransportConfig();
    const sentBefore = state.totalEventsSent;
    const result = await streamingBackfill(
      config,
      endDate,
      transportConfig,
      dryRun,
      (_day, _dayEvents, totalSent) => {
        // Update stats as we go so /stats endpoint reflects progress
        state.totalEventsSent = sentBefore + totalSent;
      },
      // Insert ad platform records into BigQuery
      async (records) => {
        const bqResult = await insertAdPlatformRecords(records);
        state.totalErrors += bqResult.failed;
        if (bqResult.failed > 0) {
          console.error(`[ad-insert] ${bqResult.failed}/${records.length} rows failed`, {
            errors: bqResult.errors.slice(0, 3),
          });
        }
        return { inserted: bqResult.inserted, failed: bqResult.failed };
      },
    );

    state.totalEventsGenerated += result.stats.totalEvents;
    state.totalEventsSent = sentBefore + result.sendResult.sent;
    state.totalErrors += result.sendResult.failed;
    state.lastRun = new Date().toISOString();
    state.isRunning = false;

    res.json({
      success: true,
      model,
      months,
      dryRun,
      stats: result.stats,
      sendResult: dryRun ? null : result.sendResult,
      adInsertResult: dryRun ? null : result.adInsertResult,
    });
  } catch (err) {
    state.isRunning = false;
    state.totalErrors++;
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ---------------------------------------------------------------------------
// Transport config
// ---------------------------------------------------------------------------

function getTransportConfig(): TransportConfig {
  return {
    ...DEFAULT_TRANSPORT_CONFIG,
    sgtmUrl: process.env['SGTM_URL'] || DEFAULT_TRANSPORT_CONFIG.sgtmUrl,
    measurementId: process.env['GA4_MEASUREMENT_ID'] || DEFAULT_TRANSPORT_CONFIG.measurementId,
  };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env['PORT'] || '8080', 10);

export function startServer(port = PORT): ReturnType<typeof app.listen> {
  return app.listen(port, () => {
    console.log(`Data generator listening on port ${port}`);
  });
}

// Start if run directly (not imported for testing)
if (require.main === module) {
  startServer();
}

export { app };
