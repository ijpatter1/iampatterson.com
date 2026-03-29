'use client';

import { usePathname } from 'next/navigation';

import { DemoNav } from '@/components/demo/demo-nav';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <DemoNav activePath={pathname} />
      {children}
    </>
  );
}
