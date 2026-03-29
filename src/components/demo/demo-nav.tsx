'use client';

import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

const demoLinks = [
  { href: '/demo/ecommerce', label: 'The Tuna Shop', short: 'E-Commerce' },
  { href: '/demo/subscription', label: 'Tuna Subscription', short: 'Subscription' },
  { href: '/demo/leadgen', label: 'Tuna Partnerships', short: 'Lead Gen' },
];

interface DemoNavProps {
  activePath?: string;
}

export function DemoNav({ activePath }: DemoNavProps) {
  return (
    <nav className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link
          href="/"
          className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          onClick={() => trackClickNav('Back to site', '/')}
          aria-label="Back to site"
        >
          &larr; Back to site
        </Link>
        <span className="h-4 w-px bg-neutral-300" aria-hidden="true" />
        {demoLinks.map(({ href, label }) => {
          const isActive = activePath?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                isActive
                  ? 'font-semibold text-neutral-900'
                  : 'text-neutral-600 hover:text-neutral-900'
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
