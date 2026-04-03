'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const demoLinks = [
  { href: '/demo/ecommerce', label: 'The Tuna Shop' },
  { href: '/demo/subscription', label: 'Tuna Subscription' },
  { href: '/demo/leadgen', label: 'Tuna Partnerships' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demosOpen, setDemosOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const demosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (demosRef.current && !demosRef.current.contains(e.target as Node)) {
        setDemosOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-border bg-surface/95 shadow-card backdrop-blur-md'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div
        className={`mx-auto flex max-w-content items-center justify-between px-6 transition-all duration-300 ${
          scrolled ? 'py-3' : 'py-5'
        }`}
      >
        <Link
          href="/"
          className={`font-display font-semibold tracking-tight transition-all duration-300 ${
            scrolled ? 'text-base text-content' : 'text-lg text-content'
          }`}
        >
          Patterson Consulting
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:block">
          <ul className="flex items-center gap-8">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm font-medium text-content-secondary transition-colors hover:text-content"
                  onClick={() => trackClickNav(label, href)}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <div ref={demosRef} className="relative">
                <button
                  type="button"
                  className="text-sm font-medium text-content-secondary transition-colors hover:text-content"
                  onClick={() => setDemosOpen(!demosOpen)}
                  aria-expanded={demosOpen}
                >
                  Demos
                  <svg
                    className={`ml-1 inline-block h-3 w-3 transition-transform ${demosOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 5l3 3 3-3" />
                  </svg>
                </button>
                {demosOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-card border border-border bg-surface py-2 shadow-elevated">
                    {demoLinks.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className="block px-4 py-2 text-sm text-content-secondary transition-colors hover:bg-surface-alt hover:text-content"
                        onClick={() => {
                          trackClickNav(label, href);
                          setDemosOpen(false);
                        }}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </li>
          </ul>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="text-content-secondary md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="border-t border-border md:hidden">
          <ul className="flex flex-col px-6 py-4">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block py-2.5 text-sm font-medium text-content-secondary transition-colors hover:text-content"
                  onClick={() => {
                    trackClickNav(label, href);
                    setMenuOpen(false);
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-border-muted pt-2">
              <span className="block py-1 text-xs font-medium uppercase tracking-wider text-content-muted">
                Demos
              </span>
              {demoLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block py-2.5 pl-3 text-sm font-medium text-content-secondary transition-colors hover:text-content"
                  onClick={() => {
                    trackClickNav(label, href);
                    setMenuOpen(false);
                  }}
                >
                  {label}
                </Link>
              ))}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
