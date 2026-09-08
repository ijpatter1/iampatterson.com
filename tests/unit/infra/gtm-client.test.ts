/**
 * The Tag Manager API client (Phase 14, deliverable 14.1).
 *
 * Thin by design — the reconciler's judgment lives in diff.js and mapping.js,
 * and this only has to fetch honestly. The assertions are about the two ways a
 * read can lie: a wrong URL, and a truncated collection.
 *
 * Pagination is the one that matters. The API returns `nextPageToken` and the
 * web container already holds 40 variables. A client that reads page one and
 * stops hands the diff a short list, which it correctly reports as "these
 * entities are missing from live" — and an apply would then create duplicates
 * of things that already exist.
 */
import { createClient, COLLECTION_KEYS } from '../../../infrastructure/gtm/lib/client.js';

interface Call {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

/** A fetch that answers from a scripted map and records what it was asked. */
function fakeFetch(routes: Record<string, unknown>, calls: Call[]) {
  return async (url: string, init: Call['init'] = {}) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (key === undefined) {
      return { ok: false, status: 404, json: async () => ({ error: { message: 'no route' } }) };
    }
    return { ok: true, status: 200, json: async () => routes[key] };
  };
}

const BASE = 'https://tagmanager.googleapis.com/tagmanager/v2/accounts/6346433751';

describe('createClient', () => {
  it('reads a collection from the workspace and unwraps its singular key', async () => {
    const calls: Call[] = [];
    const fetchImpl = fakeFetch(
      { [`${BASE}/containers/247511905/workspaces/9/tags`]: { tag: [{ name: 'GA4 - a' }] } },
      calls,
    );
    const client = createClient({ accountId: '6346433751', token: 'tok', fetchImpl });

    const tags = await client.list('247511905', '9', 'tags');
    expect(tags).toEqual([{ name: 'GA4 - a' }]);
    expect(calls[0].url).toBe(`${BASE}/containers/247511905/workspaces/9/tags`);
    expect(calls[0].init.headers?.Authorization).toBe('Bearer tok');
  });

  it('follows nextPageToken, so a long collection is not silently truncated', async () => {
    const calls: Call[] = [];
    const url = `${BASE}/containers/247511905/workspaces/9/variables`;
    let page = 0;
    const fetchImpl = async (u: string, init: Call['init'] = {}) => {
      calls.push({ url: u, init });
      page += 1;
      return page === 1
        ? {
            ok: true,
            status: 200,
            json: async () => ({ variable: [{ name: 'a' }], nextPageToken: 'p2' }),
          }
        : { ok: true, status: 200, json: async () => ({ variable: [{ name: 'b' }] }) };
    };
    const client = createClient({ accountId: '6346433751', token: 'tok', fetchImpl });

    expect(await client.list('247511905', '9', 'variables')).toEqual([
      { name: 'a' },
      { name: 'b' },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe(`${url}?pageToken=p2`);
  });

  it('returns an empty array for a collection the container does not have', async () => {
    // Web containers have no clients; server containers have no zones. An
    // absent collection is a normal shape, not a failure.
    const client = createClient({
      accountId: '6346433751',
      token: 'tok',
      fetchImpl: fakeFetch({ [`${BASE}/containers/247511905/workspaces/9/clients`]: {} }, []),
    });
    expect(await client.list('247511905', '9', 'clients')).toEqual([]);
  });

  it('surfaces an API failure with its status and message, not a bare throw', async () => {
    const client = createClient({
      accountId: '6346433751',
      token: 'tok',
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Permission denied on account.' } }),
      }),
    });
    await expect(client.list('247511905', '9', 'tags')).rejects.toThrow(
      /403.*Permission denied on account\./,
    );
  });

  it('finds the Default Workspace by name rather than assuming an id', async () => {
    // Publishing consumes a workspace and GTM creates a fresh "Default
    // Workspace" with a new numeric id — the drift trap deploy-phase6.js
    // documents at its top, where a hard-coded id had already gone stale once.
    const client = createClient({
      accountId: '6346433751',
      token: 'tok',
      fetchImpl: fakeFetch(
        {
          [`${BASE}/containers/247511905/workspaces`]: {
            workspace: [
              { workspaceId: '3', name: 'Scratch' },
              { workspaceId: '9', name: 'Default Workspace' },
            ],
          },
        },
        [],
      ),
    });
    expect(await client.defaultWorkspaceId('247511905')).toBe('9');
  });

  it('maps every collection to the response key the API actually uses', () => {
    // builtInVariable is the one that does not follow the singular-of-plural
    // rule, and getting it wrong reads as an empty collection rather than an
    // error.
    expect(COLLECTION_KEYS.built_in_variables).toBe('builtInVariable');
    expect(COLLECTION_KEYS.tags).toBe('tag');
    expect(COLLECTION_KEYS.variables).toBe('variable');
    expect(COLLECTION_KEYS.triggers).toBe('trigger');
  });
});
