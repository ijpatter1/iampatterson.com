'use client';

import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

import { useDemoTheme } from './demo-theme';

const demoLinks = [
  { href: '/demo/ecommerce', label: 'The Tuna Shop', short: 'E-Commerce' },
  { href: '/demo/subscription', label: 'Tuna Subscription', short: 'Subscription' },
  { href: '/demo/leadgen', label: 'Tuna Partnerships', short: 'Lead Gen' },
];

interface DemoNavProps {
  activePath?: string;
}

export function DemoNav({ activePath }: DemoNavProps) {
  const theme = useDemoTheme();

  return (
    <nav className="border-b border-border bg-surface-alt">
      {/* Accent color strip at top */}
      {theme.demoId && (
        <div
          className={`h-1 ${theme.borderAccentClass}`}
          style={{ backgroundColor: theme.accent }}
        />
      )}
      <div className="mx-auto flex max-w-content items-center gap-6 px-6 py-3">
        <Link
          href="/"
          className="text-sm text-content-muted transition-colors hover:text-content"
          onClick={() => trackClickNav('Back to site', '/')}
          aria-label="Back to site"
        >
          &larr; Back to site
        </Link>
        <span className="h-4 w-px bg-border-strong" aria-hidden="true" />
        {demoLinks.map(({ href, label }) => {
          const isActive = activePath?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                isActive
                  ? `font-semibold ${theme.textAccentClass || 'text-content'}`
                  : 'text-content-secondary hover:text-content'
              }`}
              onClick={() => trackClickNav(label, href)}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
