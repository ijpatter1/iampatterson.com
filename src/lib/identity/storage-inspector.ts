import { categorizeKey, type StorageCategoryId, type StorageSource } from './storage-categories';

export interface StorageEntry {
  name: string;
  value: string;
  source: StorageSource;
  category: StorageCategoryId;
}

export interface StorageSnapshot {
  entries: StorageEntry[];
  takenAt: number;
}

export interface SnapshotDiff {
  added: StorageEntry[];
  changed: { prev: StorageEntry; next: StorageEntry }[];
  removed: StorageEntry[];
}

function parseCookieJar(raw: string): { name: string; value: string }[] {
  if (!raw) return [];
  const out: { name: string; value: string }[] = [];
  for (const pair of raw.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (!name) continue;
    const rawValue = pair.slice(eq + 1).trim();
    let value = rawValue;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      // Malformed encoding — keep the raw value rather than throwing. Surfacing the verbatim
      // bytes is more honest than hiding the entry, since the visitor's browser is presumably
      // sending exactly this string back to whoever set it.
      value = rawValue;
    }
    out.push({ name, value });
  }
  return out;
}

function readWebStorage(
  storage: Storage,
  source: 'localStorage' | 'sessionStorage',
): StorageEntry[] {
  const out: StorageEntry[] = [];
  for (let i = 0; i < storage.length; i++) {
    const name = storage.key(i);
    if (name === null) continue;
    const value = storage.getItem(name);
    out.push({
      name,
      value: value ?? '',
      source,
      category: categorizeKey(name, source),
    });
  }
  return out;
}

export function readAllStorage(): StorageSnapshot {
  if (typeof window === 'undefined') {
    return { entries: [], takenAt: 0 };
  }
  const entries: StorageEntry[] = [];
  for (const { name, value } of parseCookieJar(document.cookie)) {
    entries.push({
      name,
      value,
      source: 'cookie',
      category: categorizeKey(name, 'cookie'),
    });
  }
  entries.push(...readWebStorage(window.localStorage, 'localStorage'));
  entries.push(...readWebStorage(window.sessionStorage, 'sessionStorage'));
  return { entries, takenAt: Date.now() };
}

function entryKey(e: StorageEntry): string {
  return `${e.source}::${e.name}`;
}

export function diffSnapshot(prev: StorageSnapshot, next: StorageSnapshot): SnapshotDiff {
  const prevByKey = new Map(prev.entries.map((e) => [entryKey(e), e]));
  const nextByKey = new Map(next.entries.map((e) => [entryKey(e), e]));

  const added: StorageEntry[] = [];
  const changed: { prev: StorageEntry; next: StorageEntry }[] = [];
  const removed: StorageEntry[] = [];

  for (const [key, nextEntry] of nextByKey) {
    const prevEntry = prevByKey.get(key);
    if (!prevEntry) {
      added.push(nextEntry);
    } else if (prevEntry.value !== nextEntry.value) {
      changed.push({ prev: prevEntry, next: nextEntry });
    }
  }
  for (const [key, prevEntry] of prevByKey) {
    if (!nextByKey.has(key)) removed.push(prevEntry);
  }

  return { added, changed, removed };
}
