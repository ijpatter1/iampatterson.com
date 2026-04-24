import request from 'supertest';
import { app } from './server';

// Mock the transport to avoid actual HTTP calls
jest.mock('./transport', () => ({
  ...jest.requireActual('./transport'),
  sendEvents: jest.fn().mockResolvedValue({ sent: 0, failed: 0, errors: [] }),
  DEFAULT_TRANSPORT_CONFIG: {
    sgtmUrl: 'https://test.example.com',
    measurementId: 'G-TEST',
    batchSize: 25,
    batchDelayMs: 0,
    concurrency: 25,
  },
}));

// Mock bq-insert so /generate's non-dryRun ad-insert path is testable
// without hitting BigQuery. mockInsertAdPlatformRecords is `mock`-prefixed
// so jest.mock factory hoisting accepts the reference.
const mockInsertAdPlatformRecords = jest.fn();
jest.mock('./bq-insert', () => ({
  insertAdPlatformRecords: (...args: unknown[]) => mockInsertAdPlatformRecords(...args),
  DEFAULT_BQ_CONFIG: { projectId: 'test', dataset: 'test', table: 'test' },
}));

describe('server endpoints', () => {
  describe('GET /health', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeTruthy();
    });
  });

  describe('GET /stats', () => {
    it('returns server state', async () => {
      const res = await request(app).get('/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalEventsGenerated');
      expect(res.body).toHaveProperty('totalEventsSent');
      expect(res.body).toHaveProperty('isRunning');
    });
  });

  describe('POST /generate', () => {
    it('generates events for ecommerce model (dry run)', async () => {
      const res = await request(app)
        .post('/generate')
        .send({ model: 'ecommerce', date: '2025-06-15', dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.model).toBe('ecommerce');
      expect(res.body.dryRun).toBe(true);
      expect(res.body.stats.totalSessions).toBeGreaterThan(0);
      expect(res.body.stats.totalEvents).toBeGreaterThan(0);
      expect(res.body.sendResult).toBeNull();
    });

    it('generates events for subscription model (dry run)', async () => {
      const res = await request(app)
        .post('/generate')
        .send({ model: 'subscription', date: '2025-06-15', dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.model).toBe('subscription');
      expect(res.body.stats.eventBreakdown).toHaveProperty('plan_select');
    });

    it('generates events for leadgen model (dry run)', async () => {
      const res = await request(app)
        .post('/generate')
        .send({ model: 'leadgen', date: '2025-06-15', dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.model).toBe('leadgen');
      expect(res.body.stats.eventBreakdown).toHaveProperty('page_view');
    });

    it('defaults to ecommerce model when none specified', async () => {
      const res = await request(app).post('/generate').send({ dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.model).toBe('ecommerce');
    });

    // Phase 10c Pass-2: Tech Important #1 — surface ad-insert failures.
    // Pin the outer-handler plumbing that bumps state.totalErrors and
    // logs to stderr so any future refactor that drops the += or swaps
    // console.error for a no-op is caught locally, not in production.
    it('bumps state.totalErrors + logs when ad-insert fails (non-dryRun)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockInsertAdPlatformRecords.mockResolvedValueOnce({
        inserted: 0,
        failed: 7,
        errors: ['streaming buffer collision', 'schema mismatch', 'permission denied'],
      });

      const statsBefore = await request(app).get('/stats');
      const errorsBefore = statsBefore.body.totalErrors;

      const res = await request(app)
        .post('/generate')
        .send({ model: 'ecommerce', date: '2025-06-15', dryRun: false });

      expect(res.status).toBe(200);
      expect(res.body.adInsertResult).toEqual({
        inserted: 0,
        failed: 7,
        errors: ['streaming buffer collision', 'schema mismatch', 'permission denied'],
      });

      const statsAfter = await request(app).get('/stats');
      expect(statsAfter.body.totalErrors).toBe(errorsBefore + 7);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ad-insert\] 7\/\d+ rows failed/),
        expect.objectContaining({ errors: expect.any(Array) }),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST /backfill', () => {
    it('generates backfill data (dry run)', async () => {
      const res = await request(app)
        .post('/backfill')
        .send({ model: 'ecommerce', months: 1, dryRun: true, endDate: '2025-06-15' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.months).toBe(1);
      expect(res.body.stats.totalSessions).toBeGreaterThan(0);
      expect(res.body.stats.totalEvents).toBeGreaterThan(0);
    });
  });
});
