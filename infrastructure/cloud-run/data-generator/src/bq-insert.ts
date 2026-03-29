/**
 * BigQuery insert module for ad platform data.
 *
 * Inserts AdPlatformRecord rows into the ad_platform_raw table.
 * Uses the BigQuery Storage Write API for efficient batch inserts.
 */

import { BigQuery } from '@google-cloud/bigquery';

import type { AdPlatformRecord } from './types';

export interface BqInsertConfig {
  projectId: string;
  dataset: string;
  table: string;
}

export const DEFAULT_BQ_CONFIG: BqInsertConfig = {
  projectId: process.env['GCP_PROJECT'] || 'iampatterson',
  dataset: process.env['BQ_DATASET'] || 'iampatterson_raw',
  table: process.env['BQ_AD_TABLE'] || 'ad_platform_raw',
};

export interface BqInsertResult {
  inserted: number;
  failed: number;
  errors: string[];
}

/**
 * Insert ad platform records into BigQuery.
 *
 * Uses insertAll (streaming insert) for simplicity. For very large
 * backfills, consider using the Storage Write API instead.
 */
export async function insertAdPlatformRecords(
  records: AdPlatformRecord[],
  config: BqInsertConfig = DEFAULT_BQ_CONFIG,
): Promise<BqInsertResult> {
  if (records.length === 0) {
    return { inserted: 0, failed: 0, errors: [] };
  }

  const bq = new BigQuery({ projectId: config.projectId });
  const table = bq.dataset(config.dataset).table(config.table);

  const result: BqInsertResult = { inserted: 0, failed: 0, errors: [] };

  // Batch inserts in chunks of 500 to stay under API limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    try {
      await table.insert(batch);
      result.inserted += batch.length;
    } catch (err: unknown) {
      // BigQuery insert errors include per-row details
      if (isInsertError(err)) {
        const partialErrors = err.errors || [];
        result.failed += partialErrors.length;
        result.inserted += batch.length - partialErrors.length;
        for (const rowErr of partialErrors.slice(0, 5)) {
          result.errors.push(JSON.stringify(rowErr.errors));
        }
      } else {
        result.failed += batch.length;
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  return result;
}

interface InsertError {
  errors: Array<{ errors: unknown[] }>;
}

function isInsertError(err: unknown): err is InsertError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'errors' in err &&
    Array.isArray((err as InsertError).errors)
  );
}
