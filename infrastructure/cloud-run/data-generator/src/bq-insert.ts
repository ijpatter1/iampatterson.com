/**
 * BigQuery insert module for ad platform data.
 *
 * Upserts AdPlatformRecord rows into the ad_platform_raw table via
 * MERGE on (date, platform, business_model, campaign_name). Ad-platform
 * records are inherently per-day-per-campaign aggregates; the hourly
 * generator schedule re-emits "today's" rows every tick. MERGE keeps
 * the table at one row per natural key; the latest tick wins on the
 * non-key fields (impressions, clicks, spend, cpc, ctr,
 * campaign_name_raw — the random UTM-variant pick).
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
 * Upsert ad platform records into BigQuery.
 *
 * Uses MERGE so re-running for the same (date, campaign) is idempotent:
 * the first call inserts, subsequent calls update the metrics in place.
 * `inserted` counts both INSERT and UPDATE branches as "successfully
 * applied rows" since both leave the table in the same correct state.
 */
export async function insertAdPlatformRecords(
  records: AdPlatformRecord[],
  config: BqInsertConfig = DEFAULT_BQ_CONFIG,
): Promise<BqInsertResult> {
  if (records.length === 0) {
    return { inserted: 0, failed: 0, errors: [] };
  }

  const bq = new BigQuery({ projectId: config.projectId });
  const target = `\`${config.projectId}.${config.dataset}.${config.table}\``;
  const result: BqInsertResult = { inserted: 0, failed: 0, errors: [] };

  // Chunk into 500-row MERGEs to keep query parameter size + slot
  // pressure modest. Each MERGE is one query job.
  const BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    try {
      const [job] = await bq.createQueryJob({
        query: buildMergeQuery(target),
        params: { records: batch },
        types: {
          records: [
            {
              date: 'DATE',
              platform: 'STRING',
              business_model: 'STRING',
              campaign_name: 'STRING',
              campaign_name_raw: 'STRING',
              impressions: 'INT64',
              clicks: 'INT64',
              spend: 'FLOAT64',
              cpc: 'FLOAT64',
              ctr: 'FLOAT64',
            },
          ],
        },
      });
      await job.getQueryResults();
      result.inserted += batch.length;
    } catch (err: unknown) {
      result.failed += batch.length;
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}

function buildMergeQuery(target: string): string {
  return `
    MERGE ${target} T
    USING UNNEST(@records) S
    ON T.date = S.date
       AND T.platform = S.platform
       AND T.business_model = S.business_model
       AND T.campaign_name = S.campaign_name
    WHEN MATCHED THEN UPDATE SET
      campaign_name_raw = S.campaign_name_raw,
      impressions = S.impressions,
      clicks = S.clicks,
      spend = S.spend,
      cpc = S.cpc,
      ctr = S.ctr
    WHEN NOT MATCHED THEN INSERT ROW
  `;
}
