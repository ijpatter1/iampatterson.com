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

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-neutral-900">
          Patterson Consulting
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:block">
          <ul className="flex items-center gap-8">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
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
                  className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
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
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-neutral-200 bg-white py-2 shadow-lg">
                    {demoLinks.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className="block px-4 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
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
          className="md:hidden text-neutral-600"
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
        <nav className="border-t border-neutral-100 md:hidden">
          <ul className="flex flex-col px-6 py-4">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
                  onClick={() => {
                    trackClickNav(label, href);
                    setMenuOpen(false);
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-neutral-100 pt-2">
              <span className="block py-1 text-xs font-medium uppercase tracking-wider text-neutral-400">
                Demos
              </span>
              {demoLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block py-2 pl-3 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
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
