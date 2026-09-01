/**
 * claudish-proxy — WIF credential wiring tests.
 *
 * All offline: the metadata server and the token endpoint are fake
 * fetch implementations. What these pin: the metadata URL shape
 * (audience + format=full — the federation rule matches on the email
 * claim, which only format=full carries), the jwt-bearer exchange body,
 * and the skip-without-ids contract the lane builder relies on.
 */
import {
  ANTHROPIC_BASE_URL,
  GCP_METADATA_IDENTITY_URL,
  anthropicWifCredentials,
  gcpIdentityTokenProvider,
  readWifEnv,
} from './wif';

const WIF_ENV = {
  ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test123',
  ANTHROPIC_ORGANIZATION_ID: '00000000-0000-0000-0000-000000000000',
  ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test123',
};

describe('readWifEnv', () => {
  it('returns the ids when the three required vars are present', () => {
    expect(readWifEnv(WIF_ENV)).toEqual({
      federationRuleId: 'fdrl_test123',
      organizationId: '00000000-0000-0000-0000-000000000000',
      serviceAccountId: 'svac_test123',
      workspaceId: undefined,
    });
  });

  it('passes the optional workspace id through', () => {
    expect(
      readWifEnv({ ...WIF_ENV, ANTHROPIC_WORKSPACE_ID: 'wrkspc_test123' })?.workspaceId
    ).toBe('wrkspc_test123');
  });

  it.each(Object.keys(WIF_ENV))('returns null when %s is missing', (key) => {
    const env: Record<string, string> = { ...WIF_ENV };
    delete env[key];
    expect(readWifEnv(env)).toBeNull();
  });

  it('returns null for empty-string ids', () => {
    expect(readWifEnv({ ...WIF_ENV, ANTHROPIC_FEDERATION_RULE_ID: '' })).toBeNull();
  });
});

describe('GCP_METADATA_IDENTITY_URL', () => {
  it('targets the metadata server with the Anthropic audience and format=full', () => {
    const url = new URL(GCP_METADATA_IDENTITY_URL);
    expect(url.host).toBe('metadata.google.internal');
    expect(url.searchParams.get('audience')).toBe(ANTHROPIC_BASE_URL);
    expect(url.searchParams.get('format')).toBe('full');
  });
});

describe('gcpIdentityTokenProvider', () => {
  it('fetches the metadata URL with the Metadata-Flavor header and returns the trimmed body', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response('header.payload.signature\n', { status: 200 });
    }) as typeof fetch;

    const token = await gcpIdentityTokenProvider(fetchFn)();

    expect(token).toBe('header.payload.signature');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(GCP_METADATA_IDENTITY_URL);
    expect(new Headers(calls[0].init?.headers).get('Metadata-Flavor')).toBe('Google');
  });

  it('throws with the status only on a non-2xx response (never the body)', async () => {
    const fetchFn = (async () =>
      new Response('secret-laden upstream error body', { status: 404 })) as typeof fetch;
    await expect(gcpIdentityTokenProvider(fetchFn)()).rejects.toThrow(/HTTP 404/);
    await expect(gcpIdentityTokenProvider(fetchFn)()).rejects.not.toThrow(/secret-laden/);
  });
});

describe('anthropicWifCredentials', () => {
  it('exchanges the metadata identity token at /v1/oauth/token via jwt-bearer', async () => {
    const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchFn = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (target === GCP_METADATA_IDENTITY_URL) {
        return new Response('fake.identity.jwt', { status: 200 });
      }
      posts.push({ url: target, body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({ access_token: 'sk-ant-oat01-fake', expires_in: 600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }) as typeof fetch;

    const provider = anthropicWifCredentials(
      {
        federationRuleId: 'fdrl_test123',
        organizationId: '00000000-0000-0000-0000-000000000000',
        serviceAccountId: 'svac_test123',
        workspaceId: 'wrkspc_test123',
      },
      fetchFn
    );
    const result = await provider();

    expect(result.token).toBe('sk-ant-oat01-fake');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe(`${ANTHROPIC_BASE_URL}/v1/oauth/token`);
    expect(posts[0].body).toMatchObject({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: 'fake.identity.jwt',
      federation_rule_id: 'fdrl_test123',
      organization_id: '00000000-0000-0000-0000-000000000000',
      service_account_id: 'svac_test123',
      workspace_id: 'wrkspc_test123',
    });
  });

  it('reports an expiry so the client TokenCache can refresh proactively', async () => {
    const fetchFn = (async (url: unknown) => {
      if (String(url) === GCP_METADATA_IDENTITY_URL) {
        return new Response('fake.identity.jwt', { status: 200 });
      }
      return new Response(
        JSON.stringify({ access_token: 'sk-ant-oat01-fake', expires_in: 600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }) as typeof fetch;

    const before = Math.floor(Date.now() / 1000);
    const result = await anthropicWifCredentials(
      {
        federationRuleId: 'fdrl_test123',
        organizationId: '00000000-0000-0000-0000-000000000000',
        serviceAccountId: 'svac_test123',
      },
      fetchFn
    )();

    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 500);
    expect(result.expiresAt).toBeLessThanOrEqual(before + 700);
  });
});
