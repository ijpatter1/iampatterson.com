'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const STORAGE_PREFIX = 'iampatterson.walkthrough.collapsed.';

function readPersisted(route: string): boolean | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + route);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    return null;
  }
  return null;
}

function writePersisted(route: string, collapsed: boolean) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + route, collapsed ? '1' : '0');
  } catch {
    // best-effort
  }
}

/**
 * Walkthrough blurb — per-screen demo guide (UAT r2 item 12).
 *
 * Renders a short "what you're looking at" introduction above the main
 * page content, with a collapse/expand toggle and — on mobile — a
 * `see the stack ↓` chip that smooth-scrolls to the first
 * `[data-live-sidebar]` on the page. Desktop already renders the
 * sidebar in-view to the right, so the scroll chip is hidden there.
 *
 * The `see the stack ↓` chip lives OUTSIDE the collapsible body so a
 * visitor who collapses the blurb still has a visible affordance to
 * reach the sidebar.
 *
 * Collapse state persists per-route via sessionStorage so a visitor
 * who collapses on the cart page doesn't see the blurb re-expand when
 * they navigate to checkout; each route has an independent collapse
 * state.
 */
export function WalkthroughBlurb({
  route,
  title = "What you're looking at",
  children,
  hasLiveSidebar = true,
}: {
  route: string;
  title?: string;
  children: ReactNode;
  hasLiveSidebar?: boolean;
}) {
  // SSR-safe default — initial paint is expanded, effect reconciles to
  // persisted state post-mount. Same pattern as LiveSidebar (never read
  // sessionStorage in a useState initializer — hydration mismatch).
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const persisted = readPersisted(route);
    if (persisted !== null) setCollapsed(persisted);
  }, [route]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writePersisted(route, next);
      return next;
    });
  }, [route]);

  const handleSeeStack = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof document === 'undefined') return;
    const target = document.querySelector('[data-live-sidebar]');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const bodyId = `walkthrough-body-${route}`;

  return (
    <section
      data-walkthrough-blurb=""
      data-route={route}
      className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/15 bg-[var(--shop-cream-2,#F5EEDB)]/60 p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--shop-terracotta,#C4703A)]"
          />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--shop-warm-brown,#5C4A3D)]">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {hasLiveSidebar ? (
            <button
              type="button"
              onClick={handleSeeStack}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--shop-terracotta,#C4703A)] hover:underline md:hidden"
              data-walkthrough-stack-link=""
            >
              see the stack ↓
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            aria-label={collapsed ? 'Expand walkthrough' : 'Collapse walkthrough'}
            className="font-mono text-[14px] leading-none text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
          >
            {collapsed ? '+' : '\u2212'}
          </button>
        </div>
      </header>
      {!collapsed ? (
        <div
          id={bodyId}
          className="mt-3 text-[14px] leading-[1.55] text-[var(--shop-warm-brown,#5C4A3D)]/80"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
