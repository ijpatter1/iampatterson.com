'use client';

import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

type DemoId = 'ecommerce' | 'subscription' | 'leadgen';

const demoLinks: { id: DemoId; href: string; label: string }[] = [
  { id: 'ecommerce', href: '/demo/ecommerce', label: 'The Tuna Shop' },
  { id: 'subscription', href: '/demo/subscription', label: 'Tuna Subscription' },
  { id: 'leadgen', href: '/demo/leadgen', label: 'Tuna Partnerships' },
];

interface DemoFooterNavProps {
  currentDemo: DemoId;
}

export function DemoFooterNav({ currentDemo }: DemoFooterNavProps) {
  const otherDemos = demoLinks.filter((d) => d.id !== currentDemo);

  return (
    <nav className="border-t border-border bg-surface-alt px-6 py-8">
      <div className="mx-auto flex max-w-content flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <Link
          href="/#demos"
          className="text-sm font-medium text-content-secondary transition-colors hover:text-content"
          onClick={() => trackClickNav('Back to demos', '/#demos')}
          aria-label="Back to demos"
        >
          &larr; Back to demos
        </Link>
        <div className="flex items-center gap-6">
          <span className="text-xs text-content-muted">Also explore:</span>
          {otherDemos.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-content-secondary transition-colors hover:text-content"
              onClick={() => trackClickNav(label, href)}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
