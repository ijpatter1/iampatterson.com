/**
 * @jest-environment jsdom
 */
import {
  readAllStorage,
  diffSnapshot,
  type StorageEntry,
  type StorageSnapshot,
} from '@/lib/identity/storage-inspector';

function clearAllStorage() {
  // Clear localStorage + sessionStorage.
  window.localStorage.clear();
  window.sessionStorage.clear();
  // Clear all cookies on the test document.
  for (const cookie of document.cookie.split(';')) {
    const eqPos = cookie.indexOf('=');
    const name = (eqPos > -1 ? cookie.substring(0, eqPos) : cookie).trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  clearAllStorage();
});

describe('readAllStorage', () => {
  it('returns an empty snapshot when no storage exists', () => {
    const snap = readAllStorage();
    expect(snap.entries).toEqual([]);
    expect(typeof snap.takenAt).toBe('number');
  });

  it('reads cookies from document.cookie and classifies them', () => {
    document.cookie = '_iap_aid=abc-123';
    document.cookie = '_ga=GA1.1.123.456';
    document.cookie = 'CookieConsent=granted_all';
    const snap = readAllStorage();
    const byName = Object.fromEntries(snap.entries.map((e) => [e.name, e]));
    expect(byName._iap_aid.category).toBe('app-identity');
    expect(byName._iap_aid.source).toBe('cookie');
    expect(byName._iap_aid.value).toBe('abc-123');
    expect(byName._ga.category).toBe('analytics');
    expect(byName.CookieConsent.category).toBe('consent');
  });

  it('reads localStorage keys and classifies them', () => {
    window.localStorage.setItem('iampatterson.session_state', '{"foo":"bar"}');
    window.localStorage.setItem('mystery.thing', 'x');
    const snap = readAllStorage();
    const byName = Object.fromEntries(snap.entries.map((e) => [e.name, e]));
    expect(byName['iampatterson.session_state'].category).toBe('app-identity');
    expect(byName['iampatterson.session_state'].source).toBe('localStorage');
    expect(byName['mystery.thing'].category).toBe('uncategorized');
  });

  it('reads sessionStorage keys and classifies them', () => {
    window.sessionStorage.setItem('iampatterson.overlay.booted', 'true');
    const snap = readAllStorage();
    const entry = snap.entries.find((e) => e.name === 'iampatterson.overlay.booted');
    expect(entry).toBeDefined();
    expect(entry?.source).toBe('sessionStorage');
    expect(entry?.category).toBe('app-identity');
  });

  it('reads from all three storage classes simultaneously', () => {
    document.cookie = '_iap_sid=session-123';
    window.localStorage.setItem('iampatterson.future_thing', 'value-l');
    window.sessionStorage.setItem('iampatterson.overlay.booted', 'true');
    const snap = readAllStorage();
    const sources = new Set(snap.entries.map((e) => e.source));
    expect(sources.has('cookie')).toBe(true);
    expect(sources.has('localStorage')).toBe(true);
    expect(sources.has('sessionStorage')).toBe(true);
  });

  it('decodes URI-encoded cookie values', () => {
    document.cookie = `iap_test=${encodeURIComponent('hello world / safe')}`;
    const snap = readAllStorage();
    const entry = snap.entries.find((e) => e.name === 'iap_test');
    expect(entry?.value).toBe('hello world / safe');
  });

  it('preserves cookie value verbatim when not URI-encoded (no double-decode)', () => {
    document.cookie = 'iap_plain=plainvalue';
    const snap = readAllStorage();
    const entry = snap.entries.find((e) => e.name === 'iap_plain');
    expect(entry?.value).toBe('plainvalue');
  });

  it('handles empty cookie values', () => {
    document.cookie = 'iap_empty=';
    const snap = readAllStorage();
    const entry = snap.entries.find((e) => e.name === 'iap_empty');
    expect(entry?.value).toBe('');
  });
});

describe('diffSnapshot', () => {
  function makeSnap(entries: StorageEntry[]): StorageSnapshot {
    return { entries, takenAt: 0 };
  }

  it('reports no diff when snapshots are identical', () => {
    const a = makeSnap([
      { name: '_iap_aid', value: 'x', source: 'cookie', category: 'app-identity' },
    ]);
    const b = makeSnap([
      { name: '_iap_aid', value: 'x', source: 'cookie', category: 'app-identity' },
    ]);
    const d = diffSnapshot(a, b);
    expect(d.added).toEqual([]);
    expect(d.changed).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it('reports added entries that did not exist before', () => {
    const a = makeSnap([]);
    const b = makeSnap([
      { name: '_iap_aid', value: 'new', source: 'cookie', category: 'app-identity' },
    ]);
    const d = diffSnapshot(a, b);
    expect(d.added).toHaveLength(1);
    expect(d.added[0].name).toBe('_iap_aid');
    expect(d.changed).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it('reports removed entries that exist in prev but not next', () => {
    const a = makeSnap([{ name: '_ga', value: 'old', source: 'cookie', category: 'analytics' }]);
    const b = makeSnap([]);
    const d = diffSnapshot(a, b);
    expect(d.removed).toHaveLength(1);
    expect(d.removed[0].name).toBe('_ga');
    expect(d.added).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  it('reports value-changed entries with both prev and next state', () => {
    const a = makeSnap([
      { name: '_iap_aid', value: 'old-uuid', source: 'cookie', category: 'app-identity' },
    ]);
    const b = makeSnap([
      { name: '_iap_aid', value: 'new-uuid', source: 'cookie', category: 'app-identity' },
    ]);
    const d = diffSnapshot(a, b);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0].prev.value).toBe('old-uuid');
    expect(d.changed[0].next.value).toBe('new-uuid');
  });

  it('treats same-name + same-value but different source as changed (rare but honest)', () => {
    // A key moving between cookie and localStorage IS a meaningful change to surface.
    const a = makeSnap([
      { name: 'thing', value: 'v', source: 'cookie', category: 'uncategorized' },
    ]);
    const b = makeSnap([
      { name: 'thing', value: 'v', source: 'localStorage', category: 'uncategorized' },
    ]);
    const d = diffSnapshot(a, b);
    // Different (name, source) tuple → removed from cookie + added to localStorage.
    expect(d.removed).toHaveLength(1);
    expect(d.added).toHaveLength(1);
  });
});
