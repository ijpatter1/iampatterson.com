/**
 * Tag Manager API v2 client.
 *
 * Deliberately thin: fetch honestly and get out of the way. The reconciler's
 * judgment is in diff.js and mapping.js, and `fetchImpl` is injectable so all
 * of it can be exercised offline.
 *
 * Authentication is a bearer token the caller supplies. It comes from
 * impersonating gtm-reconciler@iampatterson.iam.gserviceaccount.com — that
 * account is a member of GTM account 6346433751, which is what the Tag Manager
 * API authorizes on. There is no service-account key, here or anywhere.
 */

const API = 'https://tagmanager.googleapis.com/tagmanager/v2';

/**
 * Response key per collection. Mostly the singular of the path segment, with
 * one exception: `built_in_variables` answers under `builtInVariable`. Getting
 * that wrong yields an empty array rather than an error, so it is pinned.
 */
const COLLECTION_KEYS = {
  tags: 'tag',
  triggers: 'trigger',
  variables: 'variable',
  built_in_variables: 'builtInVariable',
  folders: 'folder',
  clients: 'client',
  templates: 'template',
  zones: 'zone',
  transformations: 'transformation',
};

function createClient({ accountId, token, fetchImpl = fetch }) {
  const base = `${API}/accounts/${accountId}`;

  async function request(url, init = {}) {
    const res = await fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (body && body.error && body.error.message) || 'no message';
      throw new Error(`Tag Manager API ${res.status}: ${message} (${url})`);
    }
    return body;
  }

  /**
   * Read a whole collection, following `nextPageToken`. Reading only page one
   * would hand the diff a short list, which it would correctly report as
   * entities missing from live — and an apply would then duplicate them.
   */
  async function list(containerId, workspaceId, collection) {
    const key = COLLECTION_KEYS[collection];
    if (!key) throw new Error(`list: unknown collection "${collection}"`);
    const url = `${base}/containers/${containerId}/workspaces/${workspaceId}/${collection}`;

    const items = [];
    let pageToken;
    do {
      const body = await request(
        pageToken ? `${url}?pageToken=${encodeURIComponent(pageToken)}` : url,
      );
      items.push(...(body[key] || []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return items;
  }

  /**
   * Resolve the Default Workspace by name. Publishing consumes its source
   * workspace and GTM creates a fresh "Default Workspace" with a new numeric
   * id — the drift trap deploy-phase6.js documents, where a hard-coded id had
   * already gone stale once.
   */
  async function defaultWorkspaceId(containerId) {
    const body = await request(`${base}/containers/${containerId}/workspaces`);
    const spaces = body.workspace || [];
    const found = spaces.find((w) => w.name === 'Default Workspace');
    if (!found) {
      // Falling back to spaces[0] would write into a renamed default, or into
      // a colleague's in-progress workspace that happened to sort first.
      throw new Error(
        `defaultWorkspaceId: container ${containerId} has no workspace named "Default Workspace" (found: ${spaces.map((w) => w.name).join(', ') || 'none'})`,
      );
    }
    return found.workspaceId;
  }

  const create = (containerId, workspaceId, collection, entity) =>
    request(`${base}/containers/${containerId}/workspaces/${workspaceId}/${collection}`, {
      method: 'POST',
      body: JSON.stringify(entity),
    });

  const update = (path, entity) =>
    request(`${API}/${path}`, { method: 'PUT', body: JSON.stringify(entity) });

  const remove = (path) => request(`${API}/${path}`, { method: 'DELETE' });

  const createVersion = (containerId, workspaceId, name) =>
    request(`${base}/containers/${containerId}/workspaces/${workspaceId}:create_version`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

  const publish = (containerId, versionId) =>
    request(`${base}/containers/${containerId}/versions/${versionId}:publish`, { method: 'POST' });

  return { list, defaultWorkspaceId, create, update, remove, createVersion, publish };
}

module.exports = { createClient, COLLECTION_KEYS, API };
