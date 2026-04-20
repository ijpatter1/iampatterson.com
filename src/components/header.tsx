'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavHint } from '@/components/chrome/nav-hint';
import { SessionPulse } from '@/components/chrome/session-pulse';
import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

import { LiveStrip } from '@/components/chrome/live-strip';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() ?? '/';
  const isHomepage = pathname === '/';
  const { open } = useOverlay();
  // Phase 9E D1: conventional nav (Home/Services/Demos/About/Contact)
  // is removed from the header; the SessionPulse is the only nav
  // affordance. Footer carries the conventional-nav escape hatch on
  // every page. `sessionPulseRef` lets NavHint classify clicks on the
  // pulse as `click_session_pulse` vs `click_outside`.
  const sessionPulseRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleOpenOverlay = () => {
    trackClickCta('Session', 'session_pulse');
    open();
  };

  return (
    <div className="sticky top-0 z-40">
      <header
        className={`border-b bg-paper transition-all ${
          scrolled ? 'border-rule-soft shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-transparent'
        }`}
      >
        {/* Mobile: SessionPulse right-aligned (hamburger position per
            UX_PIVOT_SPEC §3.1 mobile treatment + UAT S11.1 — "SessionPulse
            is top-right on mobile"). Desktop: left-aligned per §3.1 desktop
            treatment — "roughly where a primary nav's first link would sit
            — left of center or adjacent to the brand wordmark, not tucked
            in a corner." */}
        <div className="mx-auto flex max-w-content items-center justify-end gap-4 px-5 py-4 md:justify-start md:px-10">
          <span className="relative flex-shrink-0">
            <SessionPulse ref={sessionPulseRef} onClick={handleOpenOverlay} />
            <Link href="/" className="sr-only">
              Patterson Consulting — home
            </Link>
            {isHomepage && <NavHint sessionPulseRef={sessionPulseRef} />}
          </span>
        </div>
      </header>
      <LiveStrip />
      {!isHomepage && <HomeBar />}
    </div>
  );
}

/**
 * Slim "Back to homepage" bar (F5 UAT fix for S2 — "each non-homepage
 * page needs a back-to-homepage CTA; navigating via footer is too much
 * friction"). Rendered directly below the LiveStrip on services / about
 * / contact / contact-thanks / any non-/ route. Stays with the header's
 * sticky block so the affordance is always in view.
 */
function HomeBar() {
  return (
    <div data-testid="home-bar" className="border-b border-rule-soft bg-paper-alt">
      <div className="mx-auto flex max-w-content items-center px-5 py-2 md:px-10">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-widest text-ink-3 transition-colors hover:text-accent-current"
        >
          ← Back to homepage
        </Link>
      </div>
    </div>
  );
}
