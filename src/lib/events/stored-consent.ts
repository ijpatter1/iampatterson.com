/**
 * A returning visitor's stored consent, read from Cookiebot's own
 * `CookieConsent` cookie before Cookiebot has resolved it (15.8).
 *
 * On a reload with a stored choice, Cookiebot has no answer for about 180ms
 * (measured in production on 2026-11-14), and GTM evaluates its page-load
 * triggers well before that. Two readers use the cookie in the meantime:
 *
 * - `STORED_CONSENT_UPDATE_JS`, inlined into the `consent-defaults` script in
 *   `src/components/scripts/gtm.tsx`, sends the stored choice to Consent Mode
 *   right after the denied defaults, so it is in the data layer ahead of the
 *   `gtm.js` event.
 * - `readStoredConsent`, which `track.ts` uses so the events pushed before
 *   Cookiebot resolves carry the stored consent and, with analytics granted,
 *   the visitor ID.
 *
 * Both build their patterns from `flagPattern`, and a test runs both against
 * the same cookies, so the tags and the events cannot read the cookie
 * differently.
 *
 * Only a value carrying all three category flags counts as a stored choice.
 * Anything else (no cookie, Cookiebot's `-1` for a region where it asks for
 * no consent, a value this parser does not recognise) leaves the denied
 * defaults in place for Cookiebot to resolve.
 *
 * Cookie shape, as Cookiebot writes it (localhost, 2026-11-15):
 * `{stamp:%27…%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:1%2Cutc:…%2Cregion:%27…%27}`
 */

export interface StoredConsent {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const COOKIE_PATTERN = /(?:^|; ?)CookieConsent=([^;]*)/;

/** `statistics:true` between the braces or commas of the decoded value. */
function flagPattern(category: 'statistics' | 'marketing' | 'preferences'): RegExp {
  return new RegExp(`[{,]${category}:(true|false)[,}]`);
}

const STATISTICS = flagPattern('statistics');
const MARKETING = flagPattern('marketing');
const PREFERENCES = flagPattern('preferences');

/**
 * The stored choice in a `document.cookie` string, or null when there is
 * none. Global Privacy Control is not applied here: `track.ts` applies it
 * where every choice becomes consent.
 */
export function readStoredConsent(cookieHeader: string): StoredConsent | null {
  const match = COOKIE_PATTERN.exec(cookieHeader);
  if (!match) return null;
  let value = match[1];
  try {
    value = decodeURIComponent(value);
  } catch {
    // A broken escape: read the flags from the raw text.
  }
  const flag = (pattern: RegExp): boolean | null => {
    const m = pattern.exec(value);
    return m ? m[1] === 'true' : null;
  };
  const analytics = flag(STATISTICS);
  const marketing = flag(MARKETING);
  const preferences = flag(PREFERENCES);
  if (analytics === null || marketing === null || preferences === null) return null;
  return { analytics, marketing, preferences };
}

/**
 * Plain ES5 for the inline script. It expects `gtag` from the defaults above
 * it, applies Global Privacy Control the way `track.ts` does (marketing
 * declined whatever was stored), and sets `ads_data_redaction` before the
 * update, as the bridge in `track.ts` does. It catches everything: a cookie it
 * cannot read must not stop the page.
 */
export const STORED_CONSENT_UPDATE_JS = `(function(){try{
var m=${COOKIE_PATTERN}.exec(document.cookie);if(!m)return;
var v=m[1];try{v=decodeURIComponent(v);}catch(e){}
function f(r){var x=r.exec(v);return x?x[1]==='true':null;}
var a=f(${STATISTICS}),k=f(${MARKETING}),p=f(${PREFERENCES});
if(a===null||k===null||p===null)return;
if(navigator.globalPrivacyControl===true)k=false;
function y(b){return b?'granted':'denied';}
gtag('set','ads_data_redaction',!k);
gtag('consent','update',{'analytics_storage':y(a),'ad_storage':y(k),'ad_user_data':y(k),'ad_personalization':y(k),'functionality_storage':y(p),'personalization_storage':y(p)});
}catch(e){}})();`;
