import type { AdPlatformRecord } from './types';

// `mock`-prefixed names are exempt from jest.mock factory hoisting.
const mockGetQueryResults = jest.fn();
const mockCreateQueryJob = jest.fn();

jest.mock('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    createQueryJob: mockCreateQueryJob,
  })),
}));

import { insertAdPlatformRecords, DEFAULT_BQ_CONFIG } from './bq-insert';

function makeRecord(overrides: Partial<AdPlatformRecord> = {}): AdPlatformRecord {
  return {
    date: '2026-04-24',
    platform: 'google',
    business_model: 'ecommerce',
    campaign_name: 'Google - Brand - Tuna Merch',
    campaign_name_raw: 'google_brand_tuna_merch',
    impressions: 100,
    clicks: 10,
    spend: 5.0,
    cpc: 0.5,
    ctr: 0.1,
    ...overrides,
  };
}

describe('insertAdPlatformRecords', () => {
  beforeEach(() => {
    mockGetQueryResults.mockReset();
    mockCreateQueryJob.mockReset();
    mockGetQueryResults.mockResolvedValue([[]]);
    mockCreateQueryJob.mockResolvedValue([{ getQueryResults: mockGetQueryResults }]);
  });

  it('returns 0/0/empty for an empty input without calling BigQuery', async () => {
    const result = await insertAdPlatformRecords([]);
    expect(result).toEqual({ inserted: 0, failed: 0, errors: [] });
    expect(mockCreateQueryJob).not.toHaveBeenCalled();
  });

  it('runs one MERGE query for a single batch', async () => {
    const records = [makeRecord(), makeRecord({ campaign_name: 'B' })];
    const result = await insertAdPlatformRecords(records);

    expect(mockCreateQueryJob).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ inserted: 2, failed: 0, errors: [] });
  });

  it('emits a MERGE statement with PARSE_DATE on the source CTE + explicit INSERT cols', async () => {
    await insertAdPlatformRecords([makeRecord()]);

    const queryArg = mockCreateQueryJob.mock.calls[0][0];
    const sql: string = queryArg.query;

    expect(sql).toMatch(/MERGE\s+`/);
    expect(sql).toMatch(/USING\s*\(\s*SELECT[\s\S]*PARSE_DATE\('%Y-%m-%d', date\)/);
    expect(sql).toMatch(/ON\s+T\.date = S\.date/);
    expect(sql).toMatch(/AND\s+T\.platform = S\.platform/);
    expect(sql).toMatch(/AND\s+T\.business_model = S\.business_model/);
    expect(sql).toMatch(/AND\s+T\.campaign_name = S\.campaign_name/);
    expect(sql).toMatch(/WHEN MATCHED THEN UPDATE SET/);
    // INSERT spelled out — bare `INSERT ROW` shorthand fails when source
    // is UNNEST(struct array) because BQ sees the source as one column.
    expect(sql).toMatch(/WHEN NOT MATCHED THEN INSERT \(\s*date,\s*platform,\s*business_model,/);
  });

  it('passes records as a STRING-typed date param so PARSE_DATE can resolve it', async () => {
    await insertAdPlatformRecords([makeRecord()]);

    const queryArg = mockCreateQueryJob.mock.calls[0][0];
    expect(queryArg.params).toEqual({ records: [makeRecord()] });
    expect(queryArg.types.records[0].date).toBe('STRING');
    expect(queryArg.types.records[0].business_model).toBe('STRING');
    expect(queryArg.types.records[0].impressions).toBe('INT64');
    expect(queryArg.types.records[0].spend).toBe('FLOAT64');
  });

  it('targets the configured project.dataset.table', async () => {
    await insertAdPlatformRecords([makeRecord()], {
      projectId: 'p',
      dataset: 'd',
      table: 't',
    });

    const sql: string = mockCreateQueryJob.mock.calls[0][0].query;
    expect(sql).toContain('`p.d.t`');
  });

  it('uses DEFAULT_BQ_CONFIG when no config is passed', async () => {
    await insertAdPlatformRecords([makeRecord()]);

    const sql: string = mockCreateQueryJob.mock.calls[0][0].query;
    expect(sql).toContain(
      `\`${DEFAULT_BQ_CONFIG.projectId}.${DEFAULT_BQ_CONFIG.dataset}.${DEFAULT_BQ_CONFIG.table}\``,
    );
  });

  it('chunks > 500 records into multiple MERGE jobs', async () => {
    const records = Array.from({ length: 1200 }, (_, i) =>
      makeRecord({ campaign_name: `Campaign ${i}` }),
    );

    const result = await insertAdPlatformRecords(records);

    expect(mockCreateQueryJob).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ inserted: 1200, failed: 0, errors: [] });
  });

  it('reports the full batch as failed when the query throws', async () => {
    mockCreateQueryJob.mockRejectedValueOnce(new Error('streaming buffer collision'));
    const records = [makeRecord(), makeRecord({ campaign_name: 'B' })];

    const result = await insertAdPlatformRecords(records);

    expect(result.inserted).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual(['streaming buffer collision']);
  });

  it('continues to subsequent batches after one batch fails', async () => {
    mockCreateQueryJob
      .mockRejectedValueOnce(new Error('first batch failed'))
      .mockResolvedValueOnce([{ getQueryResults: mockGetQueryResults }]);
    const records = Array.from({ length: 600 }, (_, i) => makeRecord({ campaign_name: `C${i}` }));

    const result = await insertAdPlatformRecords(records);

    expect(mockCreateQueryJob).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(500);
    expect(result.inserted).toBe(100);
    expect(result.errors).toEqual(['first batch failed']);
  });
});
