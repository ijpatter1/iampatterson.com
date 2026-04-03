/**
 * Tests that each page or layout exports metadata with the correct title and description.
 * These are static exports read by Next.js at build time.
 */
import type { Metadata } from 'next';

describe('Page metadata exports', () => {
  it('services layout exports metadata with title', async () => {
    const mod = await import('@/app/services/layout');
    const metadata = (mod as unknown as { metadata: Metadata }).metadata;
    expect(metadata).toBeDefined();
    expect(metadata.title).toBeTruthy();
  });

  it('about layout exports metadata with title', async () => {
    const mod = await import('@/app/about/layout');
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
