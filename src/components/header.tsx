'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavHint } from '@/components/chrome/nav-hint';
import { SessionPulse } from '@/components/chrome/session-pulse';
import { useOverlay } from '@/components/overlay/overlay-context';
import { HERO } from '@/lib/content/hero';
import { REVIEW_PAGE_HREF } from '@/lib/content/review';
import { trackClickCta } from '@/lib/events/track';

import { LiveStrip } from '@/components/chrome/live-strip';
import { showHomeBar, showLiveStrip } from '@/lib/chrome/suppression';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() ?? '/';
  const isHomepage = pathname === '/';
  const { open } = useOverlay();
  // Phase 9E D1: conventional nav (Home/Services/Demos/About/Contact)
  // is removed from the header; the SessionPulse and, since 15.4, the
  // review link are its only affordances. `sessionPulseRef` lets NavHint classify clicks on the
  // pulse (which hides the hint visually without firing a dismissal
  // event) vs `click_outside` (which fires `nav_hint_dismissed`).
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
            UX_PIVOT_SPEC §3.1 mobile treatment + UAT S11.1, "SessionPulse
            is top-right on mobile"). Desktop: left-aligned per §3.1 desktop
            treatment, "roughly where a primary nav's first link would sit
          , left of center or adjacent to the brand wordmark, not tucked
            in a corner." */}
        <div className="mx-auto flex max-w-content items-center justify-end gap-4 px-5 py-4 md:justify-start md:px-10">
          <span className="relative flex-shrink-0">
            <SessionPulse ref={sessionPulseRef} onClick={handleOpenOverlay} />
            <Link href="/" className="sr-only">
              I am Patterson, home
            </Link>
            {isHomepage && <NavHint sessionPulseRef={sessionPulseRef} />}
          </span>
          {/* 15.4: the way to the review, on every page, in the homepage
              call to action's words. First on mobile so the pulse keeps the
              top-right corner; after the pulse, at the far end, from md up.
              Kept compact and unwrapped so the row fits a 375px screen
              beside the pulse and the hero keeps its fold. */}
          <Link
            href={REVIEW_PAGE_HREF}
            onClick={() => trackClickCta(HERO.primaryCta, 'header_review')}
            className="order-first mr-auto inline-flex min-h-[44px] items-center whitespace-nowrap text-sm font-semibold text-ink underline decoration-rule underline-offset-4 transition-colors hover:decoration-ink md:order-none md:ml-auto md:mr-0"
          >
            {HERO.primaryCta}
          </Link>
        </div>
      </header>
      {showLiveStrip(pathname) && <LiveStrip />}
      {showHomeBar(pathname) && <HomeBar />}
    </div>
  );
}

/**
 * Slim "Back to homepage" bar (F5 UAT fix for S2, "each non-homepage
 * page needs a back-to-homepage CTA; navigating via footer is too much
 * friction"). Rendered directly below the LiveStrip on services / about
 * / contact / contact-thanks. F8 polish: text-ink-2 (was text-ink-3)
 * so it reads as an action, not chrome; arrow gets a hover-translate
 * for discoverability.
 */
function HomeBar() {
  return (
    <div data-testid="home-bar" className="border-b border-rule-soft bg-paper-alt">
      <div className="mx-auto flex max-w-content items-center px-5 py-2 md:px-10">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-2 transition-colors hover:text-accent-current"
        >
          <span className="inline-block transition-transform group-hover:-translate-x-0.5">←</span>
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
