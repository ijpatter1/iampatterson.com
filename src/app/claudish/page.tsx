import { ClaudishApp } from '@/components/claudish/claudish-app';
import { decodeShare } from '@/lib/claudish/share-codec';

import type { Metadata } from 'next';

interface PageProps {
  searchParams: Promise<{ t?: string }>;
}

/**
 * A valid share param upgrades the unfurl to the dynamic two-panel OG
 * card; anything else inherits the layout's static metadata untouched.
 * Reading searchParams makes the route dynamic — expected and fine.
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { t } = await searchParams;
  if (!t || !decodeShare(t)) return {};
  const ogUrl = `/claudish/og?t=${encodeURIComponent(t)}`;
  return {
    openGraph: { images: [{ url: ogUrl, width: 1200, height: 630 }] },
    twitter: { images: [ogUrl] },
  };
}

export default async function ClaudishPage({ searchParams }: PageProps) {
  const { t } = await searchParams;
  return <ClaudishApp shareParam={t} />;
}
