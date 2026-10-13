/**
 * Global Privacy Control: a standing opt-out of sale, sharing and targeted
 * advertising that the visitor sets once in their browser. The homepage says
 * this site honors it, so every place that turns a banner choice into consent
 * reads the signal here (`track.ts`), and every place that tells the visitor
 * about it reads it through `useGlobalPrivacyControl`.
 *
 * Only the boolean `true` the specification defines counts. A browser that
 * does not implement the signal leaves the property undefined.
 */
export function isGlobalPrivacyControlEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    (navigator as Navigator & { globalPrivacyControl?: unknown }).globalPrivacyControl === true
  );
}
