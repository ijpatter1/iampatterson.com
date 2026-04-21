'use client';

import { usePathname } from 'next/navigation';

import { Footer } from '@/components/footer';

export function FooterSlot() {
  const pathname = usePathname();
  if (pathname?.startsWith('/demo/ecommerce')) {
    return null;
  }
  return <Footer />;
}
