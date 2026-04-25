'use client';

import { useState } from 'react';

import { STORAGE_CATEGORIES, type StorageCategoryId } from '@/lib/identity/storage-categories';
import type { StorageEntry, StorageSnapshot } from '@/lib/identity/storage-inspector';

const ALWAYS_SHOWN: readonly StorageCategoryId[] = [
  'app-identity',
  'analytics',
  'consent',
  'third-party',
];
const TRUNCATE_AT = 40;

const SOURCE_LABEL: Record<StorageEntry['source'], string> = {
  cookie: 'cookie',
  localStorage: 'localStorage',
  sessionStorage: 'sessionStorage',
};

function truncate(value: string): string {
  if (value.length <= TRUNCATE_AT) return value;
  return `${value.slice(0, TRUNCATE_AT)}…`;
}

function StorageRow({ entry }: { entry: StorageEntry }) {
  const [revealed, setRevealed] = useState(false);
  const isLong = entry.value.length > TRUNCATE_AT;
  const visible = revealed || !isLong ? entry.value : truncate(entry.value);

  return (
    <li
      data-testid={`storage-row-${entry.source}-${entry.name}`}
      data-storage-source={entry.source}
      data-storage-category={entry.category}
      className="flex flex-col gap-1 border-l border-u-rule-soft px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3"
    >
      <span className="font-mono text-[11px] text-u-ink">{entry.name}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-u-ink-3">
        {SOURCE_LABEL[entry.source]}
      </span>
      <span
        data-testid="storage-value"
        className="break-all font-mono text-[11px] text-u-ink-2 sm:flex-1"
      >
        {visible || <span className="text-u-ink-3">(empty)</span>}
      </span>
      {isLong && (
        <button
          type="button"
          data-testid="storage-row-reveal"
          onClick={() => setRevealed((r) => !r)}
          className="self-start font-mono text-[10px] uppercase tracking-widest text-accent-current hover:underline sm:self-auto"
        >
          {revealed ? 'truncate' : 'reveal'}
        </button>
      )}
    </li>
  );
}

function StorageGroup({
  category,
  label,
  description,
  entries,
}: {
  category: StorageCategoryId;
  label: string;
  description: string;
  entries: StorageEntry[];
}) {
  const count = entries.length;
  return (
    <details
      data-testid={`storage-group-${category}`}
      data-storage-category={category}
      data-key-count={String(count)}
      open={count > 0}
      className="group border border-u-rule-soft bg-u-paper-alt"
    >
      <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-3 font-mono text-xs uppercase tracking-widest text-u-ink hover:text-accent-current">
        <span>
          {label}
          <span className="ml-2 text-u-ink-3 normal-case">{description}</span>
        </span>
        <span className="text-u-ink-3">{count === 1 ? '1 key' : `${count} keys`}</span>
      </summary>
      {count === 0 ? (
        <p className="px-4 pb-3 font-mono text-xs text-u-ink-3">— none yet</p>
      ) : (
        <ul className="space-y-0">
          {entries.map((entry) => (
            <StorageRow key={`${entry.source}::${entry.name}`} entry={entry} />
          ))}
        </ul>
      )}
    </details>
  );
}

export function StorageInspector({ snapshot }: { snapshot: StorageSnapshot }) {
  const grouped: Record<StorageCategoryId, StorageEntry[]> = {
    'app-identity': [],
    analytics: [],
    consent: [],
    'third-party': [],
    uncategorized: [],
  };
  for (const entry of snapshot.entries) grouped[entry.category].push(entry);

  const visibleCategories = STORAGE_CATEGORIES.filter(
    (cat) => ALWAYS_SHOWN.includes(cat.id) || grouped[cat.id].length > 0,
  );

  return (
    <section data-testid="consent-storage-inspector" className="mt-8">
      <h4 className="font-mono text-[10px] uppercase tracking-widest text-u-ink">
        Browser storage · what consent actually wrote
      </h4>
      <p className="mt-2 max-w-[62ch] text-xs leading-relaxed text-u-ink-3">
        Every cookie, localStorage, and sessionStorage key your browser is holding for this site
        right now. An empty third-party group is the payoff — proof your consent denial held.
      </p>
      <div className="mt-3 space-y-2">
        {visibleCategories.map((cat) => (
          <StorageGroup
            key={cat.id}
            category={cat.id}
            label={cat.label}
            description={cat.description}
            entries={grouped[cat.id]}
          />
        ))}
      </div>
      <p className="mt-3 max-w-[62ch] font-mono text-[10px] leading-relaxed text-u-ink-3">
        Note: browsers expose only cookie names and values to JavaScript. Expiry, domain, and path
        metadata are written by the tag that set the cookie but cannot be read back — the keys
        themselves are the visible signal.
      </p>
    </section>
  );
}
