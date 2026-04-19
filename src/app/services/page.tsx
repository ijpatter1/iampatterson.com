'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { EditorialButton, EditorialLink } from '@/components/chrome/editorial-button';
import { useOverlay } from '@/components/overlay/overlay-context';
import { TIERS } from '@/lib/content/tiers';
import { trackClickCta } from '@/lib/events/track';

export default function ServicesPage() {
  const [activeTier, setActiveTier] = useState('01');
  const { open } = useOverlay();

  useEffect(() => {
    let rafId: number | null = null;
    const sync = () => {
      rafId = null;
      const y = window.scrollY + 200;
      for (let i = TIERS.length - 1; i >= 0; i--) {
        const el = document.getElementById('tier-' + TIERS[i].num);
        if (el && el.offsetTop <= y) {
          setActiveTier(TIERS[i].num);
          return;
        }
      }
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(sync);
    };
    // Initial sync — only when already scrolled. At scrollY=0 the default
    // activeTier '01' is already correct; forcing sync() would match the
    // last tier whose offsetTop (0 in jsdom / the topmost section in the
    // browser) is ≤ y.
    if (window.scrollY > 0) sync();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <main>
      {/* Hero */}
      <section className="bg-paper pt-8 pb-16 md:pt-12 md:pb-20">
        <div className="mx-auto max-w-content px-5 md:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-3">
            <span>Services · Four tiers · Decision gates between each</span>
            <span>iampatterson.com</span>
          </div>
          <h1
            className="mt-8 font-display font-normal text-ink"
            style={{
              fontSize: 'clamp(48px, 10vw, 160px)',
              lineHeight: '0.94',
              letterSpacing: '-0.025em',
            }}
          >
            End-to-end
            <br />
            measurement
            <br />
            infrastructure. <em className="text-accent-current">Not</em>
            <br />
            just another tag
            <br />
            implementation.
          </h1>
          <div className="mt-12 grid gap-8 border-t border-rule-soft pt-8 md:grid-cols-[1fr_1.8fr] md:gap-16">
            <p
              className="font-display italic text-ink"
              style={{
                fontSize: 'clamp(22px, 2.6vw, 34px)',
                lineHeight: '1.25',
              }}
            >
              Four tiers. Each one delivers standalone value. Each one makes the next one possible.
            </p>
            <p className="max-w-[56ch] text-base leading-[1.7] text-ink-2">
              I structure engagements as discrete tiers with decision gates between them. You buy
              what you need, see the results, and decide whether to go further. The first two tiers
              have non-negotiable components — these are the things that must be done properly or
              not at all. Everything else is modular and scoped to your specific situation.
            </p>
          </div>
        </div>
      </section>

      {/* Tier layout — sticky nav + content */}
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className="grid gap-10 md:grid-cols-[240px_1fr] md:gap-14">
          <aside className="hidden md:block">
            <nav
              aria-label="Tiers"
              data-testid="tier-nav"
              className="sticky top-36 flex flex-col gap-3 border-l border-rule-soft pl-4"
            >
              {TIERS.map((t) => {
                const active = activeTier === t.num;
                return (
                  <a
                    key={t.num}
                    href={`#tier-${t.num}`}
                    data-active={active}
                    className={`flex items-baseline gap-3 text-sm transition-colors ${
                      active ? 'text-accent-current' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    <span className="font-mono text-[10px] tracking-widest">{t.num}</span>
                    {t.title}
                  </a>
                );
              })}
            </nav>
          </aside>

          <div>
            {TIERS.map((t) => (
              <section
                key={t.num}
                id={`tier-${t.num}`}
                data-testid={`tier-${t.num}`}
                className="scroll-mt-36 border-b border-rule-soft py-12 first:pt-0 md:py-20"
              >
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-ink-3">
                    TIER {t.num}
                  </div>
                  <h2
                    className="mt-2 font-display font-normal text-ink"
                    style={{
                      fontSize: 'clamp(36px, 5.5vw, 72px)',
                      lineHeight: '1',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {t.title}
                  </h2>
                  <div
                    className="mt-2 font-display italic text-ink-2"
                    style={{ fontSize: 'clamp(20px, 2.4vw, 28px)', lineHeight: '1.25' }}
                  >
                    {t.subtitle}
                  </div>
                </div>

                <p className="mt-8 max-w-[62ch] text-base leading-[1.7] text-ink-2">{t.lede}</p>

                {t.core.length > 0 && (
                  <div className="mt-12">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                      What&apos;s included · non-negotiable
                    </div>
                    <div className="mt-4 divide-y divide-rule-soft border-y border-rule-soft">
                      {t.core.map((c, i) => (
                        <div
                          key={c.title}
                          className="grid gap-4 py-6 md:grid-cols-[280px_1fr] md:gap-10"
                        >
                          <div className="flex items-baseline gap-4">
                            <span className="font-mono text-[11px] tracking-widest text-ink-3">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <h4 className="font-display text-xl text-ink">{c.title}</h4>
                          </div>
                          <p className="text-sm leading-[1.7] text-ink-2">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {t.optional.length > 0 && (
                  <div className="mt-10">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                      {t.core.length > 0
                        ? 'Additional components · scoped per client'
                        : 'Components · all modular'}
                    </div>
                    <div className="mt-4 divide-y divide-rule-soft border-y border-rule-soft">
                      {t.optional.map((c, i) => (
                        <div
                          key={c.title}
                          className="grid gap-4 py-6 md:grid-cols-[280px_1fr] md:gap-10"
                        >
                          <div className="flex items-baseline gap-4">
                            <span className="font-mono text-[11px] tracking-widest text-ink-3">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <h4 className="font-display text-xl text-ink-2">{c.title}</h4>
                          </div>
                          <p className="text-sm leading-[1.7] text-ink-2">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-10 rounded-sm border-l-2 border-accent-current bg-paper-alt py-5 pl-5 pr-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                    What you get at the end of Tier {t.num}
                  </div>
                  <p className="mt-2 text-base leading-[1.6] text-ink">{t.summary}</p>
                  {t.seeItLive && (
                    <Link
                      href={t.seeItLive.href}
                      onClick={() => trackClickCta('See it live', `services_tier_${t.num}`)}
                      className="mt-4 inline-block text-sm text-accent-current underline-offset-4 hover:underline"
                    >
                      See it live →
                    </Link>
                  )}
                </div>
              </section>
            ))}

            {/* Closer */}
            <section className="py-14 md:py-24">
              <h2
                className="font-display font-normal text-ink"
                style={{
                  fontSize: 'clamp(28px, 4vw, 56px)',
                  lineHeight: '1.05',
                  letterSpacing: '-0.015em',
                }}
              >
                Not sure where you&apos;d start?{' '}
                <em className="text-accent-current">Watch it run first.</em>
              </h2>
              <p className="mt-5 max-w-[56ch] text-base leading-[1.65] text-ink-2">
                Every page on this site is instrumented with the same Tier 1 foundation. Look under
                the hood on any page to see your session flowing through the stack. The best pitch I
                have is the one running underneath you.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <EditorialButton
                  variant="accent"
                  onClick={() => {
                    trackClickCta('Look under the hood', 'services_closer');
                    open();
                  }}
                >
                  Look under the hood →
                </EditorialButton>
                <EditorialLink
                  href="/contact"
                  variant="ghost"
                  onClick={() => trackClickCta('Start a conversation', 'services_closer')}
                >
                  Start a conversation
                </EditorialLink>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
