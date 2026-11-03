import { CONTACT_CONFIG } from './config';

/** Google's suggested default for a score-based key: 0 is a bot, 1 a person. */
export const RECAPTCHA_MIN_SCORE = 0.5;

export type Assessment =
  | { ok: true; score: number }
  | { ok: false; score: number | null; reason: 'invalid_token' | 'wrong_action' | 'low_score' };

/**
 * Asks reCAPTCHA Enterprise about a token from the browser. A token passes only
 * if it is valid, was minted for the contact action, and scores at or above the
 * threshold.
 */
export async function assessToken(
  token: string,
  serviceAccountToken: string,
  deps: { fetch?: typeof fetch } = {},
): Promise<Assessment> {
  const doFetch = deps.fetch ?? fetch;
  const res = await doFetch(
    `https://recaptchaenterprise.googleapis.com/v1/projects/${CONTACT_CONFIG.projectId}/assessments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceAccountToken}`,
      },
      body: JSON.stringify({
        event: {
          token,
          siteKey: CONTACT_CONFIG.recaptchaSiteKey,
          expectedAction: CONTACT_CONFIG.recaptchaAction,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`recaptcha assessment failed with HTTP ${res.status}`);
  const a = (await res.json()) as {
    tokenProperties?: { valid?: boolean; action?: string };
    riskAnalysis?: { score?: number };
  };
  const score = typeof a.riskAnalysis?.score === 'number' ? a.riskAnalysis.score : null;
  if (!a.tokenProperties?.valid) return { ok: false, score, reason: 'invalid_token' };
  if (a.tokenProperties.action !== CONTACT_CONFIG.recaptchaAction) {
    return { ok: false, score, reason: 'wrong_action' };
  }
  if (score === null || score < RECAPTCHA_MIN_SCORE)
    return { ok: false, score, reason: 'low_score' };
  return { ok: true, score };
}
