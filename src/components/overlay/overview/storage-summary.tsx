'use client';

import { STORAGE_CATEGORIES, type StorageCategoryId } from '@/lib/identity/storage-categories';
import type { StorageSnapshot } from '@/lib/identity/storage-inspector';

const ALWAYS_SHOWN: readonly StorageCategoryId[] = [
  'app-identity',
  'analytics',
  'consent',
  'third-party',
];

function countByCategory(snapshot: StorageSnapshot): Record<StorageCategoryId, number> {
  const counts: Record<StorageCategoryId, number> = {
    'app-identity': 0,
    analytics: 0,
    consent: 0,
    'third-party': 0,
    uncategorized: 0,
  };
  for (const entry of snapshot.entries) counts[entry.category]++;
  return counts;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${singular}s`;
}

export function StorageSummary({ snapshot }: { snapshot: StorageSnapshot }) {
  const counts = countByCategory(snapshot);
  const visibleCategories = STORAGE_CATEGORIES.filter(
    (cat) => ALWAYS_SHOWN.includes(cat.id) || counts[cat.id] > 0,
  );

  return (
    <section data-testid="overview-storage">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-accent-current">
        Browser storage
      </h3>
      <p className="mb-4 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
        What this site, your CMP, and any tags have written to your browser. Full per-key detail in
        the Consent tab.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        {visibleCategories.map((cat) => {
          const count = counts[cat.id];
          return (
            <li key={cat.id}>
              <div
                data-testid={`storage-chip-${cat.id}`}
                data-storage-category={cat.id}
                data-key-count={String(count)}
                className="flex flex-col gap-1 border border-u-rule-soft bg-u-paper-alt p-3"
              >
                <span className="font-mono text-xs uppercase tracking-widest text-u-ink-3">
                  {cat.label}
                </span>
                <span className="font-mono text-sm text-u-ink-2">{pluralize(count, 'key')}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
