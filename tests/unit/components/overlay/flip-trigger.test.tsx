/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FlipTrigger } from '@/components/overlay/flip-trigger';
import { OverlayProvider } from '@/components/overlay/overlay-context';

function renderWithProvider() {
  return render(
    <OverlayProvider>
      <FlipTrigger />
    </OverlayProvider>,
  );
}

describe('FlipTrigger', () => {
  it('renders a button with accessible label', () => {
    renderWithProvider();
    const button = screen.getByRole('button', { name: /under the hood/i });
    expect(button).toBeInTheDocument();
  });

  it('has aria-expanded false when overlay is closed', () => {
    renderWithProvider();
    const button = screen.getByRole('button', { name: /under the hood/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles aria-expanded on click', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    const button = screen.getByRole('button', { name: /under the hood/i });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('is keyboard accessible (Enter and Space)', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    const button = screen.getByRole('button', { name: /under the hood/i });
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('has fixed positioning classes', () => {
    renderWithProvider();
    const button = screen.getByRole('button', { name: /under the hood/i });
    expect(button.className).toContain('fixed');
  });
});
