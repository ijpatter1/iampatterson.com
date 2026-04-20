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
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-5 py-4 md:px-10">
          {/* SessionPulse — primary nav affordance. Relatively positioned
              so NavHint (child of this wrapper) can anchor itself to
              the pulse via absolute positioning. The sr-only home link
              preserves site-identity semantics for assistive tech; the
              wordmark is intentionally absent per the spec's "instrument
              as nav" principle. */}
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
    </div>
  );
}
