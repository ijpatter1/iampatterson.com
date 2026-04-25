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

  // Responsive layout: each atom (name, source label, value+reveal) on
  // its own row on mobile; single horizontal row on sm+. Most overlay
  // surfaces use a single horizontal layout because their content is
  // short (consent labels, destination chip names). Storage atoms here
  // are individually long: long key names like `iampatterson.session_state`
  // (24 chars), long source labels like `SESSIONSTORAGE` (14 chars
  // uppercase tracking-widest), and long values (full UUIDs, JSON blobs,
  // encoded consent strings). Two prior attempts at this shape failed:
  // (1) the original `flex items-baseline gap-3` squeezed the value
  // column to 1-char width and rendered values one character per line
  // vertically; (2) the followup `flex flex-col` outer + inner-div
  // wrappers grouped name+source on one row but `shrink-0` on the wrapper
  // overflowed horizontally on iPhone-SE width when name+source combined
  // exceeded the ~290px viewport content width. This shape — direct
  // children of <li>, each with `sm:shrink-0` (mobile shrinks; desktop
  // doesn't) — lets each atom claim its own line on mobile and collapse
  // into a single row on sm+. Don't "fix" this back to nested wrappers
  // or a single horizontal row to match other surfaces — the content
  // shape is genuinely different here.
  return (
    <li
      data-testid={`storage-row-${entry.source}-${entry.name}`}
      data-storage-source={entry.source}
      data-storage-category={entry.category}
      className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3"
    >
      <span className="font-mono text-[11px] text-u-ink sm:shrink-0">{entry.name}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-u-ink-3 sm:shrink-0">
        {SOURCE_LABEL[entry.source]}
      </span>
      <div className="flex min-w-0 items-baseline gap-3 sm:flex-1">
        <span
          data-testid="storage-value"
          className="min-w-0 flex-1 break-all font-mono text-[11px] text-u-ink-2"
        >
          {visible || <span className="text-u-ink-3">(empty)</span>}
        </span>
        {isLong && (
          <button
            type="button"
            data-testid="storage-row-reveal"
            onClick={() => setRevealed((r) => !r)}
            className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-accent-current hover:underline"
          >
            {revealed ? 'truncate' : 'reveal'}
          </button>
        )}
      </div>
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
    <div
      data-testid={`storage-group-${category}`}
      data-storage-category={category}
      data-key-count={String(count)}
      className="mt-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h5 className="font-mono text-[10px] uppercase tracking-widest text-u-ink">{label}</h5>
        <span className="font-mono text-[10px] text-u-ink-3">
          {count === 1 ? '1 key' : `${count} keys`}
        </span>
      </div>
      <p className="mt-1 max-w-[62ch] text-xs text-u-ink-3">{description}</p>
      {count === 0 ? (
        <p className="mt-2 font-mono text-xs text-u-ink-3">— none yet</p>
      ) : (
        <ul className="mt-2 divide-y divide-u-rule-soft border border-u-rule-soft bg-u-paper-alt">
          {entries.map((entry) => (
            <StorageRow key={`${entry.source}::${entry.name}`} entry={entry} />
          ))}
        </ul>
      )}
    </div>
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
        Browser storage
      </h4>
      <p className="mt-2 max-w-[62ch] text-xs leading-relaxed text-u-ink-3">
        Every cookie, localStorage, and sessionStorage key your browser is holding for this site,
        right now.
      </p>
      {visibleCategories.map((cat) => (
        <StorageGroup
          key={cat.id}
          category={cat.id}
          label={cat.label}
          description={cat.description}
          entries={grouped[cat.id]}
        />
      ))}
      <p className="mt-6 max-w-[62ch] font-mono text-[10px] leading-relaxed text-u-ink-3">
        Browsers expose only cookie names and values to JavaScript. Expiry, domain, and path
        metadata are written by the tag that set the cookie but can&apos;t be read back.
      </p>
    </section>
  );
}
