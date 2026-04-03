'use client';

import { usePathname } from 'next/navigation';

import { DemoFooterNav } from '@/components/demo/demo-footer-nav';
import { DemoThemeProvider } from '@/components/demo/demo-theme';

type DemoId = 'ecommerce' | 'subscription' | 'leadgen';

function resolveDemoId(pathname: string): DemoId | null {
  if (pathname.startsWith('/demo/ecommerce')) return 'ecommerce';
  if (pathname.startsWith('/demo/subscription')) return 'subscription';
  if (pathname.startsWith('/demo/leadgen')) return 'leadgen';
  return null;
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const demoId = resolveDemoId(pathname);

  return (
    <DemoThemeProvider pathname={pathname}>
      {children}
      {demoId && <DemoFooterNav currentDemo={demoId} />}
    </DemoThemeProvider>
  );
}
