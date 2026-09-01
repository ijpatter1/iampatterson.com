/**
 * claudish-proxy — Anthropic lane credentials via Workload Identity
 * Federation.
 *
 * The Cloud Run runtime service account proves its identity with a
 * Google-signed OIDC token from the metadata server; the SDK exchanges
 * it at POST /v1/oauth/token (RFC 7523 jwt-bearer) for a short-lived
 * sk-ant-oat01-... access token scoped to the federation rule's
 * workspace. No static key exists anywhere on this lane.
 *
 * Latency note: oidcFederationProvider performs a fresh exchange per
 * invocation, but the Anthropic client wraps the provider in its own
 * TokenCache (advisory refresh at expiry-120s, mandatory at expiry-30s,
 * 401 invalidation), so requests do NOT pay an exchange round trip.
 *
 * The identity token must be requested with format=full: the federation
 * rule matches on both sub (the SA's numeric unique id) and email, and
 * only format=full tokens carry the email claim.
 */
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';

import type {
  AccessTokenProvider,
  IdentityTokenProvider,
} from '@anthropic-ai/sdk/lib/credentials/types';

export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export const GCP_METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity' +
  `?audience=${encodeURIComponent(ANTHROPIC_BASE_URL)}&format=full`;

export interface WifEnv {
  federationRuleId: string;
  organizationId: string;
  serviceAccountId: string;
  workspaceId?: string;
}

/**
 * The lane's availability contract: all three required ids or nothing.
 * The ids are identifiers, not secrets — they arrive as plain env vars.
 */
export function readWifEnv(env: NodeJS.ProcessEnv): WifEnv | null {
  const federationRuleId = env.ANTHROPIC_FEDERATION_RULE_ID;
  const organizationId = env.ANTHROPIC_ORGANIZATION_ID;
  const serviceAccountId = env.ANTHROPIC_SERVICE_ACCOUNT_ID;
  if (!federationRuleId || !organizationId || !serviceAccountId) return null;
  return {
    federationRuleId,
    organizationId,
    serviceAccountId,
    workspaceId: env.ANTHROPIC_WORKSPACE_ID || undefined,
  };
}

export function gcpIdentityTokenProvider(fetchFn: typeof fetch = fetch): IdentityTokenProvider {
  return async () => {
    const response = await fetchFn(GCP_METADATA_IDENTITY_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
    });
    if (!response.ok) {
      // Status only — the body is unowned upstream content and stays out
      // of thrown messages the logger might serialize.
      throw new Error(`metadata identity token fetch failed: HTTP ${response.status}`);
    }
    return (await response.text()).trim();
  };
}

export function anthropicWifCredentials(
  wif: WifEnv,
  fetchFn: typeof fetch = fetch
): AccessTokenProvider {
  return oidcFederationProvider({
    identityTokenProvider: gcpIdentityTokenProvider(fetchFn),
    federationRuleId: wif.federationRuleId,
    organizationId: wif.organizationId,
    serviceAccountId: wif.serviceAccountId,
    workspaceId: wif.workspaceId,
    baseURL: ANTHROPIC_BASE_URL,
    fetch: fetchFn,
  });
}
