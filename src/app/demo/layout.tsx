'use client';

import { usePathname } from 'next/navigation';

import { DemoFooterNav } from '@/components/demo/demo-footer-nav';
import { DemoThemeProvider } from '@/components/demo/demo-theme';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDemoRoute = pathname.startsWith('/demo/');

  return (
    <DemoThemeProvider pathname={pathname}>
      {children}
      {isDemoRoute && <DemoFooterNav />}
    </DemoThemeProvider>
  );
}
