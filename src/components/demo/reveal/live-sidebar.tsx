'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const STORAGE_PREFIX = 'iampatterson.sidebar.collapsed.';

function readPersisted(route: string): boolean | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + route);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // sessionStorage may throw if disabled (Safari private mode, quotas).
    return null;
  }
  return null;
}

function writePersisted(route: string, collapsed: boolean) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + route, collapsed ? '1' : '0');
  } catch {
    // Persistence is best-effort; failure to write doesn't change UI behaviour.
  }
}

/**
 * Pattern 2 — Live sidebar (Phase 9F deliverable 2).
 *
 * Collapsible Tier 2 readout panel. Right-rail on ≥1024px, top accordion
 * below. Position-relative / sticky (NOT fixed) — scrolls with page content
 * so it doesn't permanently occlude.
 *
 * Collapse state persists within-route via sessionStorage, never across routes
 * (each demo page re-presents its Tier 2 content open-by-default).
 */
export function LiveSidebar({
  route,
  title,
  tag,
  defaultOpen = true,
  children,
}: {
  route: string;
  title: string;
  tag: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  // SSR-safe initial state: defaultOpen-derived. Persisted state is read on
  // mount in a useEffect to avoid SSR/CSR text-content mismatches (the lesson
  // from 9E UAT F4 hydration revert: never read sessionStorage in useState
  // initializer if the value affects rendered text).
  const [collapsed, setCollapsed] = useState<boolean>(!defaultOpen);
  const rootRef = useRef<HTMLElement | null>(null);

  // On mount + on route change, reconcile against persisted state for THIS route.
  useEffect(() => {
    const persisted = readPersisted(route);
    if (persisted !== null) {
      setCollapsed(persisted);
    } else {
      setCollapsed(!defaultOpen);
    }
  }, [route, defaultOpen]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writePersisted(route, next);
      return next;
    });
  }, [route]);

  // Escape collapses sidebar when focus is inside it (focus does not trap).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      if (active && root.contains(active)) {
        setCollapsed(true);
        writePersisted(route, true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [route]);

  return (
    <aside
      ref={rootRef}
      data-live-sidebar=""
      data-collapsed={collapsed ? 'true' : 'false'}
      data-route={route}
      aria-label="Tier 2 instrumentation readout"
      className={`relative flex flex-col overflow-hidden rounded border border-[#F3C769]/20 bg-[#0D0B09] font-mono text-xs text-[#EAD9BC] ${
        collapsed ? 'w-10 lg:w-8' : 'w-full lg:w-[360px]'
      } z-sidebar`}
    >
      <div
        data-sidebar-scanlines=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgba(243,199,105,0.04)_2px,rgba(243,199,105,0.04)_3px)]"
      />
      {collapsed ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded="false"
          aria-label="Expand instrumentation sidebar"
          className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-2 px-1 py-4 text-[#F3C769]"
        >
          <span className="rotate-180 [writing-mode:vertical-rl] text-[10px] tracking-[0.2em]">
            {tag}
          </span>
          <span aria-hidden="true">‹</span>
        </button>
      ) : (
        <div className="relative z-10 flex flex-col gap-3 p-4">
          <header className="flex items-start justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#F3C769]">{tag}</div>
            <button
              type="button"
              onClick={toggle}
              aria-expanded="true"
              aria-label="Collapse instrumentation sidebar"
              className="text-[#F3C769] hover:text-[#EAD9BC]"
            >
              ›
            </button>
          </header>
          <h3 className="font-display text-base leading-tight text-[#EAD9BC]">{title}</h3>
          <div className="flex flex-col gap-2">{children}</div>
          <footer className="flex items-center gap-2 border-t border-[#F3C769]/20 pt-2 text-[10px] text-[#9E8A6B]">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#8FBF7A]"
            />
            <span>LIVE · streaming from sGTM</span>
          </footer>
        </div>
      )}
    </aside>
  );
}
