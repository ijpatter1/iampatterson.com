/**
 * @jest-environment jsdom
 *
 * The homepage composes section components — each has its own dedicated
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
      /I build.*measurement.*infrastructure/s,
    );
  });
});
