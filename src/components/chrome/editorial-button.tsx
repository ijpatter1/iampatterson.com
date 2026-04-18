'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type Variant = 'accent' | 'solid' | 'ghost';

const variantClasses: Record<Variant, string> = {
  // Accent — dynamic persimmon/phosphor fill from --accent
  accent:
    'border border-accent-current bg-accent-current text-paper hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent-current focus-visible:ring-offset-2',
  // Solid ink — default dark button from the prototype's .btn
  solid:
    'border border-ink bg-ink text-paper hover:bg-ink-2 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
  // Ghost — transparent outline
  ghost:
    'border border-rule-soft bg-transparent text-ink hover:border-ink hover:bg-paper-alt focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
};

const baseClasses =
  'inline-flex items-center gap-2.5 rounded-sm px-5 py-3.5 text-sm font-semibold transition-all focus:outline-none';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant;
  children: ReactNode;
}

export function EditorialButton({
  variant = 'solid',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface LinkProps extends ComponentPropsWithoutRef<typeof Link> {
  variant?: Variant;
  children: ReactNode;
}

export function EditorialLink({ variant = 'solid', className = '', children, ...rest }: LinkProps) {
  return (
    <Link className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}
