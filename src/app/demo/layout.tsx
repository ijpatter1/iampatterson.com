'use client';

import { usePathname } from 'next/navigation';

import { DemoFooterNav } from '@/components/demo/demo-footer-nav';
import { DemoThemeProvider } from '@/components/demo/demo-theme';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDemoRoute = pathname.startsWith('/demo/');
  // The ecommerce demo carries its own brand-voiced EcomFooter (Phase 9F
  // Major #4) — suppress the generic DemoFooterNav on those routes so the
  // two footers don't stack. Any future non-ecommerce demo (sub/leadgen
  // when they return) keeps the generic footer until it gets its own.
  const isEcommerce = pathname.startsWith('/demo/ecommerce');

  return (
    <DemoThemeProvider pathname={pathname}>
      {children}
      {isDemoRoute && !isEcommerce && <DemoFooterNav />}
    </DemoThemeProvider>
  );
}
