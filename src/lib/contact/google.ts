import { getVercelOidcToken } from '@vercel/oidc';

import { CONTACT_CONFIG } from './config';

/**
 * The keyless path from a Vercel function to Google, in plain HTTP so each
 * step is visible and testable:
 *
 *   Vercel OIDC token
 *     → STS token exchange (workload identity pool `vercel`)
 *     → an access token for the `contact-form` service account
 *     → that account signs a domain-wide-delegation assertion for the mailbox
 *     → a Gmail token that can only send.
 */

interface Deps {
  fetch?: typeof fetch;
  getOidcToken?: () => Promise<string>;
}

const CLOUD_PLATFORM = 'https://www.googleapis.com/auth/cloud-platform';
const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send';
const IAM_CREDENTIALS = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${CONTACT_CONFIG.serviceAccount}`;

async function json<T>(step: string, res: Response): Promise<T> {
  // The step name goes into the error, never the response body: a Google
  // error can echo the request.
  if (!res.ok) throw new Error(`${step} failed with HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** An access token for the service account, for reCAPTCHA and for signing. */
export async function getServiceAccountToken(deps: Deps = {}): Promise<string> {
  const doFetch = deps.fetch ?? fetch;
  const oidc = await (deps.getOidcToken ?? (() => getVercelOidcToken()))();

  const sts = await json<{ access_token: string }>(
    'sts',
    await doFetch('https://sts.googleapis.com/v1/token', {
      method: 'POST',
      signal: AbortSignal.timeout(CONTACT_CONFIG.googleTimeoutMs),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        audience: CONTACT_CONFIG.workloadIdentityAudience,
        scope: CLOUD_PLATFORM,
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        subject_token: oidc,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      }).toString(),
    }),
  );

  const sa = await json<{ accessToken: string }>(
    'generateAccessToken',
    await doFetch(`${IAM_CREDENTIALS}:generateAccessToken`, {
      method: 'POST',
      signal: AbortSignal.timeout(CONTACT_CONFIG.googleTimeoutMs),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sts.access_token}` },
      body: JSON.stringify({ scope: [CLOUD_PLATFORM], lifetime: '300s' }),
    }),
  );
  return sa.accessToken;
}

/** A Gmail token that can only send, acting as the mailbox. */
export async function getGmailToken(serviceAccountToken: string, deps: Deps = {}): Promise<string> {
  const doFetch = deps.fetch ?? fetch;
  const now = Math.floor(Date.now() / 1000);

  const signed = await json<{ signedJwt: string }>(
    'signJwt',
    await doFetch(`${IAM_CREDENTIALS}:signJwt`, {
      method: 'POST',
      signal: AbortSignal.timeout(CONTACT_CONFIG.googleTimeoutMs),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceAccountToken}`,
      },
      body: JSON.stringify({
        payload: JSON.stringify({
          iss: CONTACT_CONFIG.serviceAccount,
          sub: CONTACT_CONFIG.delegatedUser,
          scope: GMAIL_SEND,
          aud: 'https://oauth2.googleapis.com/token',
          iat: now,
          exp: now + 300,
        }),
      }),
    }),
  );

  const token = await json<{ access_token: string }>(
    'oauth2',
    await doFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      signal: AbortSignal.timeout(CONTACT_CONFIG.googleTimeoutMs),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signed.signedJwt,
      }).toString(),
    }),
  );
  return token.access_token;
}
