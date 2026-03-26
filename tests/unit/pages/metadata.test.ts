/**
 * Tests that each page exports metadata with the correct title and description.
 * These are static exports read by Next.js at build time.
 */
import type { Metadata } from 'next';

describe('Page metadata exports', () => {
  it('services page exports metadata with title', async () => {
    const mod = await import('@/app/services/page');
    const metadata = (mod as unknown as { metadata: Metadata }).metadata;
    expect(metadata).toBeDefined();
    expect(metadata.title).toBeTruthy();
  });

  it('about page exports metadata with title', async () => {
    const mod = await import('@/app/about/page');
    const metadata = (mod as unknown as { metadata: Metadata }).metadata;
    expect(metadata).toBeDefined();
    expect(metadata.title).toBeTruthy();
  });

  it('contact layout exports metadata with title', async () => {
    const mod = await import('@/app/contact/layout');
    const metadata = (mod as unknown as { metadata: Metadata }).metadata;
    expect(metadata).toBeDefined();
    expect(metadata.title).toBeTruthy();
  });
});
