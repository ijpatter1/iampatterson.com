/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LiveSidebar } from '@/components/demo/reveal/live-sidebar';

const STORAGE_KEY = 'iampatterson.sidebar.collapsed.test-route';

describe('LiveSidebar', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders title, tag, and children when open', () => {
    render(
      <LiveSidebar route="test-route" title="Staging layer" tag="UNDER · TIER 2">
        <div>readout content</div>
      </LiveSidebar>,
    );
    expect(screen.getByText('Staging layer')).toBeInTheDocument();
    expect(screen.getByText('UNDER · TIER 2')).toBeInTheDocument();
    expect(screen.getByText('readout content')).toBeInTheDocument();
  });

  it('renders the LIVE · streaming from sGTM footer when open', () => {
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <div>x</div>
      </LiveSidebar>,
    );
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    expect(screen.getByText(/streaming from sGTM/)).toBeInTheDocument();
  });

  it('uses an aside element with aria-label describing the rail', () => {
    render(
      <LiveSidebar route="test-route" title="Staging layer" tag="UNDER · TIER 2">
        <div>x</div>
      </LiveSidebar>,
    );
    const aside = document.querySelector('aside[data-live-sidebar]');
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('aria-label')).toMatch(/instrumentation/i);
  });

  it('defaults to open (defaultOpen unspecified)', () => {
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <div>visible</div>
      </LiveSidebar>,
    );
    expect(screen.getByText('visible')).toBeInTheDocument();
    const aside = document.querySelector('aside[data-live-sidebar]');
    expect(aside?.getAttribute('data-collapsed')).toBe('false');
  });

  it('respects defaultOpen={false} on first render', () => {
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2" defaultOpen={false}>
        <div>hidden</div>
      </LiveSidebar>,
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
    const aside = document.querySelector('aside[data-live-sidebar]');
    expect(aside?.getAttribute('data-collapsed')).toBe('true');
  });

  it('collapses when the collapse toggle is clicked, persists to sessionStorage', async () => {
    const user = userEvent.setup();
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <div>readout</div>
      </LiveSidebar>,
    );
    expect(screen.getByText('readout')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /collapse/i });
    await user.click(toggle);
    expect(screen.queryByText('readout')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('expands when the collapsed handle is clicked', async () => {
    const user = userEvent.setup();
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2" defaultOpen={false}>
        <div>readout</div>
      </LiveSidebar>,
    );
    const handle = screen.getByRole('button', { name: /expand/i });
    await user.click(handle);
    expect(screen.getByText('readout')).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('0');
  });

  it('honours sessionStorage on initial mount (within-route persistence)', () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <div>readout</div>
      </LiveSidebar>,
    );
    // Even though defaultOpen=true, persisted "collapsed" state wins on mount.
    expect(screen.queryByText('readout')).not.toBeInTheDocument();
  });

  it('explicit defaultOpen=false overrides any sessionStorage "0" state on mount of a new route', () => {
    // Different route → different storage key → no persisted state for this route.
    sessionStorage.setItem('iampatterson.sidebar.collapsed.other-route', '0');
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2" defaultOpen={false}>
        <div>readout</div>
      </LiveSidebar>,
    );
    expect(screen.queryByText('readout')).not.toBeInTheDocument();
  });

  it('does not persist state across routes, separate routes use separate storage keys', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LiveSidebar route="route-a" title="t" tag="UNDER">
        <div>readout-a</div>
      </LiveSidebar>,
    );
    await user.click(screen.getByRole('button', { name: /collapse/i }));
    expect(sessionStorage.getItem('iampatterson.sidebar.collapsed.route-a')).toBe('1');

    rerender(
      <LiveSidebar route="route-b" title="t" tag="UNDER">
        <div>readout-b</div>
      </LiveSidebar>,
    );
    // Route B opens with default (open) regardless of A's collapsed state.
    expect(screen.getByText('readout-b')).toBeInTheDocument();
    expect(sessionStorage.getItem('iampatterson.sidebar.collapsed.route-b')).toBeNull();
  });

  it('Escape key collapses sidebar when focus is inside it', async () => {
    const user = userEvent.setup();
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <button>focusable</button>
      </LiveSidebar>,
    );
    const inner = screen.getByText('focusable');
    inner.focus();
    expect(document.activeElement).toBe(inner);
    await user.keyboard('{Escape}');
    expect(screen.queryByText('focusable')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('Escape key does NOT collapse sidebar when focus is outside it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>outside</button>
        <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
          <div>readout</div>
        </LiveSidebar>
      </div>,
    );
    screen.getByText('outside').focus();
    await user.keyboard('{Escape}');
    expect(screen.getByText('readout')).toBeInTheDocument();
  });

  it('collapse toggle is a real button with aria-expanded reflecting state', async () => {
    const user = userEvent.setup();
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <div>x</div>
      </LiveSidebar>,
    );
    const toggle = screen.getByRole('button', { name: /collapse/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await user.click(toggle);
    const handle = screen.getByRole('button', { name: /expand/i });
    expect(handle.getAttribute('aria-expanded')).toBe('false');
  });

  it('handles sessionStorage throws gracefully (fallback to defaultOpen)', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() =>
      render(
        <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
          <div>readout</div>
        </LiveSidebar>,
      ),
    ).not.toThrow();
    expect(screen.getByText('readout')).toBeInTheDocument();
    setItemSpy.mockRestore();
  });

  it('handles sessionStorage.getItem throws gracefully on mount', () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() =>
      render(
        <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
          <div>readout</div>
        </LiveSidebar>,
      ),
    ).not.toThrow();
    // Falls back to defaultOpen (true), readout visible.
    expect(screen.getByText('readout')).toBeInTheDocument();
    getItemSpy.mockRestore();
  });

  it('renders scanline texture layer (aria-hidden)', () => {
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <div>x</div>
      </LiveSidebar>,
    );
    const scanlines = document.querySelector('[data-sidebar-scanlines]');
    expect(scanlines).not.toBeNull();
    expect(scanlines?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses sticky/relative positioning, not fixed', () => {
    render(
      <LiveSidebar route="test-route" title="t" tag="UNDER · TIER 2">
        <div>x</div>
      </LiveSidebar>,
    );
    const aside = document.querySelector('aside[data-live-sidebar]') as HTMLElement;
    // Class list should not include `fixed`, sidebar must scroll with content.
    expect(aside.className).not.toMatch(/\bfixed\b/);
  });

  // UAT r2 items 14 + 17, mobile round-trip. On mobile the sidebar
  // stacks below main content, so a visitor who scrolled to read it
  // ends up at the bottom. The header carries a mobile-only "↑ back to
  // top" chip that smooth-scrolls to the page's walkthrough blurb (or
  // window top as fallback).
  describe('UAT r2 items 14 + 17, back-to-top chip', () => {
    it('renders a mobile-only back-to-top chip in the header when open', () => {
      render(
        <LiveSidebar route="cart" title="Data quality" tag="UNDER · DATAFORM ASSERTIONS">
          <div>x</div>
        </LiveSidebar>,
      );
      const chip = document.querySelector('[data-sidebar-back-to-top]') as HTMLElement;
      expect(chip).not.toBeNull();
      expect(chip.textContent).toMatch(/back to top/i);
      expect(chip.className).toMatch(/md:hidden/);
    });

    it('clicking back-to-top scrolls to the walkthrough blurb when one exists', async () => {
      const blurb = document.createElement('section');
      blurb.setAttribute('data-walkthrough-blurb', '');
      const scrollSpy = jest.fn();
      blurb.scrollIntoView = scrollSpy;
      document.body.appendChild(blurb);

      const user = userEvent.setup();
      render(
        <LiveSidebar route="cart" title="t" tag="UNDER">
          <div>x</div>
        </LiveSidebar>,
      );
      await user.click(document.querySelector('[data-sidebar-back-to-top]') as HTMLElement);
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

      blurb.remove();
    });

    it('back-to-top chip does not render when the sidebar is collapsed', () => {
      // Persisted collapsed state, simulate a visitor who has already
      // tapped the collapse chevron. The header collapses into a single
      // writing-mode-rotated expand-button; the back-to-top chip is
      // scoped to the expanded state.
      sessionStorage.setItem('iampatterson.sidebar.collapsed.cart', '1');
      render(
        <LiveSidebar route="cart" title="t" tag="UNDER">
          <div>x</div>
        </LiveSidebar>,
      );
      expect(document.querySelector('[data-sidebar-back-to-top]')).toBeNull();
    });
  });
});
