/**
 * @jest-environment jsdom
 *
 * The homepage composes section components, each has its own dedicated
 * test file (hero.test.tsx, pipeline.test.tsx, etc.). This file only
 * verifies that the composition itself is in place.
 */
import { render, screen } from '@testing-library/react';

import HomePage from '@/app/page';
import { OverlayProvider } from '@/components/overlay/overlay-context';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
  trackClickNav: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));

// next/server imports Web Fetch's Request global, which jsdom doesn't
// provide. The homepage Server Component calls `after(() =>
// warmMetabaseDashboard())` (Phase 10a D2) and we only care here that
// the page composes; the `after()` wiring is pinned by
// tests/unit/app/keep-warm-wiring.test.ts via source sniff.
jest.mock('next/server', () => ({ after: jest.fn() }));

function renderHome() {
  return render(
    <OverlayProvider>
      <HomePage />
    </OverlayProvider>,
  );
}

describe('HomePage composition', () => {
  it('renders the editorial hero masthead', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /I build[\s\S]*measurement[\s\S]*infrastructure/,
    );
  });
});
