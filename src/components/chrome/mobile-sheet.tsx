'use client';

import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

import { NAV_LINKS } from './nav-links';
import { SessionPulse } from './session-pulse';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  currentPath: string;
}

/**
 * Full-height slide-in menu for small viewports. Numbered editorial list
 * of top-level nav items.
 */
export function MobileSheet({ open, onClose, currentPath }: MobileSheetProps) {
  return (
    <div
      data-testid="mobile-sheet"
      aria-hidden={!open}
      className={`fixed inset-0 z-50 flex flex-col bg-paper transition-transform duration-300 md:hidden ${
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        className="absolute right-5 top-5 rounded-sm p-2 text-ink hover:bg-paper-alt focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-current"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>

      <nav className="flex flex-1 flex-col justify-center gap-6 px-8">
        {NAV_LINKS.map((l) => {
          const active = currentPath === l.href || (l.href === '/' && currentPath === '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => {
                trackClickNav(l.label, l.href);
                onClose();
              }}
              className={`flex items-baseline gap-4 font-display text-4xl leading-none transition-colors ${
                active ? 'text-accent-current' : 'text-ink hover:text-accent-current'
              }`}
            >
              <span className="font-mono text-xs tracking-widest text-ink-3">{l.num}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-rule-soft px-8 py-5 font-mono text-[10px] tracking-wide text-ink-3">
        <SessionPulse />
        <span>iampatterson.com</span>
      </div>
    </div>
  );
}
