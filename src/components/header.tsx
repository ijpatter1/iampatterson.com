'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MobileSheet } from '@/components/chrome/mobile-sheet';
import { NAV_LINKS } from '@/components/chrome/nav-links';
import { SessionPulse } from '@/components/chrome/session-pulse';
import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta, trackClickNav } from '@/lib/events/track';

import { LiveStrip } from '@/components/chrome/live-strip';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() ?? '/';
  const { open } = useOverlay();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleOpenOverlay = () => {
    trackClickCta('Under the hood', 'header-session-pulse');
    open();
  };

  return (
    <div className="sticky top-0 z-40">
      <header
        className={`border-b bg-paper transition-all ${
          scrolled ? 'border-rule-soft shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-5 py-4 md:px-10">
          <span className="flex-shrink-0">
            <SessionPulse onClick={handleOpenOverlay} />
            <Link href="/" className="sr-only">
              Patterson Consulting — home
            </Link>
          </span>

          <nav className="hidden md:block">
            <ul className="flex items-center gap-7">
              {NAV_LINKS.map((l) => {
                const active =
                  l.href === '/#demos'
                    ? false
                    : l.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => trackClickNav(l.label, l.href)}
                      className={`text-sm transition-colors ${
                        active ? 'font-medium text-ink' : 'font-normal text-ink-2 hover:text-ink'
                      }`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex-shrink-0 rounded-sm p-1 text-ink hover:bg-paper-alt md:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>
      <LiveStrip />
      <MobileSheet open={menuOpen} onClose={() => setMenuOpen(false)} currentPath={pathname} />
    </div>
  );
}
