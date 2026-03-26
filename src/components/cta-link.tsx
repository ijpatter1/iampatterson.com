'use client';

import Link from 'next/link';

import { trackClickCta } from '@/lib/events/track';

interface CtaLinkProps {
  href: string;
  children: React.ReactNode;
  ctaLocation: string;
  className?: string;
  disabled?: boolean;
}

export function CtaLink({ href, children, ctaLocation, className, disabled }: CtaLinkProps) {
  const ctaText = typeof children === 'string' ? children : '';

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} onClick={() => trackClickCta(ctaText, ctaLocation)}>
      {children}
    </Link>
  );
}
