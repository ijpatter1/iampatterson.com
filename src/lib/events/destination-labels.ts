/** Human-readable labels for pipeline routing destinations. */
export const DESTINATION_LABELS: Record<string, string> = {
  ga4: 'GA4',
  bigquery: 'BigQuery',
  meta_capi: 'Meta',
  google_ads: 'Google Ads',
  pubsub: 'Pub/Sub',
};

export function destinationLabel(dest: string): string {
  return DESTINATION_LABELS[dest] ?? dest;
}
