'use client';

import { Children, isValidElement, type ReactNode } from 'react';
import Link from 'next/link';

import { trackClickCta } from '@/lib/events/track';

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  if (node != null) return Children.toArray(node).map(extractText).join('');
  return '';
}

interface CtaLinkProps {
  href: string;
  children: React.ReactNode;
  ctaLocation: string;
  className?: string;
  disabled?: boolean;
}

export function CtaLink({ href, children, ctaLocation, className, disabled }: CtaLinkProps) {
  const ctaText = extractText(children);

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
