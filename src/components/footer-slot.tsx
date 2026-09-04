'use client';

import { usePathname } from 'next/navigation';

import { Footer } from '@/components/footer';
import { showSiteFooter } from '@/lib/chrome/suppression';

export function FooterSlot() {
  const pathname = usePathname();
  if (pathname && !showSiteFooter(pathname)) {
    return null;
  }
  return <Footer />;
}
