/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WalkthroughBlurb } from '@/components/demo/reveal/walkthrough-blurb';

describe('WalkthroughBlurb (UAT r2 item 12)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('renders the title + body by default (expanded)', () => {
    render(
      <WalkthroughBlurb route="test">
        <p>the body copy</p>
      </WalkthroughBlurb>,
    );
    expect(screen.getByText(/what you're looking at/i)).toBeInTheDocument();
    expect(screen.getByText('the body copy')).toBeInTheDocument();
  });

  it('collapses the body when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WalkthroughBlurb route="test">
        <p>the body copy</p>
      </WalkthroughBlurb>,
    );
    await user.click(screen.getByRole('button', { name: /collapse walkthrough/i }));
    expect(screen.queryByText('the body copy')).not.toBeInTheDocument();
  });

  it('re-expands the body after a second toggle click', async () => {
    const user = userEvent.setup();
    render(
      <WalkthroughBlurb route="test">
        <p>the body copy</p>
      </WalkthroughBlurb>,
    );
    await user.click(screen.getByRole('button', { name: /collapse walkthrough/i }));
    await user.click(screen.getByRole('button', { name: /expand walkthrough/i }));
    expect(screen.getByText('the body copy')).toBeInTheDocument();
  });

  it('persists collapse state per-route via sessionStorage', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <WalkthroughBlurb route="checkout">
        <p>the body copy</p>
      </WalkthroughBlurb>,
    );
    await user.click(screen.getByRole('button', { name: /collapse walkthrough/i }));
    unmount();

    // Re-mount — should hydrate to collapsed.
    render(
      <WalkthroughBlurb route="checkout">
        <p>the body copy</p>
      </WalkthroughBlurb>,
    );
    expect(screen.queryByText('the body copy')).not.toBeInTheDocument();
  });

  it('renders "see the stack ↓" chip when hasLiveSidebar is true (default)', () => {
    render(
      <WalkthroughBlurb route="test">
        <p>body</p>
      </WalkthroughBlurb>,
    );
    expect(document.querySelector('[data-walkthrough-stack-link]')).not.toBeNull();
  });

  it('suppresses "see the stack" chip when hasLiveSidebar is false', () => {
    render(
      <WalkthroughBlurb route="listing" hasLiveSidebar={false}>
        <p>body</p>
      </WalkthroughBlurb>,
    );
    expect(document.querySelector('[data-walkthrough-stack-link]')).toBeNull();
  });

  it('"see the stack" chip is hidden on md+ via md:hidden (desktop renders sidebar in-view)', () => {
    render(
      <WalkthroughBlurb route="cart">
        <p>body</p>
      </WalkthroughBlurb>,
    );
    const chip = document.querySelector('[data-walkthrough-stack-link]') as HTMLElement;
    expect(chip.className).toMatch(/md:hidden/);
  });

  it('"see the stack" chip lives OUTSIDE the collapsible body so collapsed visitors keep the scroll link', async () => {
    const user = userEvent.setup();
    render(
      <WalkthroughBlurb route="cart">
        <p>the body copy</p>
      </WalkthroughBlurb>,
    );
    // Collapse the body.
    await user.click(screen.getByRole('button', { name: /collapse walkthrough/i }));
    // Stack chip still present.
    expect(document.querySelector('[data-walkthrough-stack-link]')).not.toBeNull();
    // Body gone.
    expect(screen.queryByText('the body copy')).not.toBeInTheDocument();
  });

  it('clicking "see the stack" invokes scrollIntoView on the first [data-live-sidebar] element', async () => {
    const sidebar = document.createElement('aside');
    sidebar.setAttribute('data-live-sidebar', '');
    const scrollSpy = jest.fn();
    sidebar.scrollIntoView = scrollSpy;
    document.body.appendChild(sidebar);

    const user = userEvent.setup();
    render(
      <WalkthroughBlurb route="cart">
        <p>body</p>
      </WalkthroughBlurb>,
    );
    await user.click(document.querySelector('[data-walkthrough-stack-link]') as HTMLElement);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    sidebar.remove();
  });

  it('accepts a custom title', () => {
    render(
      <WalkthroughBlurb route="t" title="What just happened">
        <p>body</p>
      </WalkthroughBlurb>,
    );
    expect(screen.getByText('What just happened')).toBeInTheDocument();
  });
});
