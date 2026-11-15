'use client';

import { usePathname } from 'next/navigation';

import { DemoThemeProvider } from '@/components/demo/demo-theme';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <DemoThemeProvider pathname={pathname}>{children}</DemoThemeProvider>;
}
