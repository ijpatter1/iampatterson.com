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

jest.mock('@/lib/metabase/keep-warm', () => ({
  warmMetabaseDashboard: jest.fn(),
}));

// next/server imports Web Fetch's Request global, which jsdom doesn't
// provide. Phase 10a D2 wires the homepage Server Component with
// `after(() => warmMetabaseDashboard())`, so we replace `after` with a
// spy that both (a) unblocks the jsdom import and (b) lets the test
// below observe the per-request call shape and execute the callback
// so a regression where the warmup hook is dropped or the callback is
// shadowed fails loudly. Source-sniff pins in
// tests/unit/app/keep-warm-wiring.test.ts are the complementary
// wiring guard; this test adds the behavior-level check.
const afterMock = jest.fn((cb: () => void) => cb());
jest.mock('next/server', () => ({
  after: (cb: () => void) => afterMock(cb),
}));

function renderHome() {
  return render(
    <OverlayProvider>
      <HomePage />
    </OverlayProvider>,
  );
}

describe('HomePage composition', () => {
  beforeEach(() => {
    afterMock.mockClear();
  });

  it('renders the editorial hero masthead', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /I build[\s\S]*measurement[\s\S]*infrastructure/,
    );
  });

  // Phase 10a D2 behaviour pin (complementing the source-sniff in
  // keep-warm-wiring.test.ts): homepage render must invoke `after()`
  // exactly once with a callback that, when executed, calls the real
  // warmMetabaseDashboard hook. Catches refactors that drop the
  // warmup wiring or shadow the hook with a different function.
  it('schedules the Metabase warmup via after() on render', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keepWarm = require('@/lib/metabase/keep-warm') as {
      warmMetabaseDashboard: jest.Mock;
    };
    keepWarm.warmMetabaseDashboard.mockClear();

    renderHome();

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(typeof afterMock.mock.calls[0][0]).toBe('function');
    // The mock invokes the callback synchronously, which should have
    // driven warmMetabaseDashboard exactly once.
    expect(keepWarm.warmMetabaseDashboard).toHaveBeenCalledTimes(1);
  });
});
