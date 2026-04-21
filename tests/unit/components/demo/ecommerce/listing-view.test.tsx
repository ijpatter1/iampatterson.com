/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ListingView } from '@/components/demo/ecommerce/listing-view';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';
import { CartProvider } from '@/components/demo/ecommerce/cart-context';

let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/ecommerce',
}));

const mockAddToCart = jest.fn();
jest.mock('@/lib/events/track', () => ({
  trackAddToCart: (...args: unknown[]) => mockAddToCart(...args),
  trackProductView: jest.fn(),
}));

function renderView() {
  return render(
    <ToastProvider>
      <CartProvider>
        <ListingView />
      </CartProvider>
    </ToastProvider>,
  );
}

describe('ListingView (Phase 9F D5 — product listing)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearchParams = new URLSearchParams();
    mockAddToCart.mockClear();
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders the editorial listing hero with eyebrow, serif headline, and lede', () => {
    renderView();
    // Eyebrow in mono uppercase
    expect(screen.getByText(/the tuna shop · 6 things/i)).toBeInTheDocument();
    // Headline fragment (prototype: "the underdog with the underbite.")
    expect(screen.getByText(/underdog/i)).toBeInTheDocument();
    expect(screen.getByText(/underbite/i)).toBeInTheDocument();
  });

  it('renders the your-utm + classified-as panel below the hero', () => {
    mockSearchParams = new URLSearchParams({ utm_campaign: 'google_brand_tuna' });
    renderView();
    // Raw utm visible
    expect(screen.getByText(/google_brand_tuna/i)).toBeInTheDocument();
    // Classified chips
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText(/brand · search/i)).toBeInTheDocument();
  });

  it('uses the default UTM seed when searchParams has no utm_campaign', () => {
    renderView();
    expect(screen.getByText(/meta_prospecting_lal_tuna_q1/i)).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText(/prospecting · lookalike/i)).toBeInTheDocument();
  });

  it('renders all 6 products in a grid', () => {
    renderView();
    expect(screen.getByText('Tuna Plush')).toBeInTheDocument();
    expect(screen.getByText('2026 Tuna Calendar')).toBeInTheDocument();
    expect(screen.getByText('Colin Plush')).toBeInTheDocument();
    expect(screen.getByText('Perfectly Imperfect Plush')).toBeInTheDocument();
    expect(screen.getByText('Cameo from Tuna')).toBeInTheDocument();
    expect(screen.getByText('Plush + Calendar')).toBeInTheDocument();
  });

  it('renders product prices formatted to 2dp', () => {
    renderView();
    expect(screen.getByText('$26.00')).toBeInTheDocument();
    expect(screen.getByText('$14.00')).toBeInTheDocument();
    expect(screen.getByText('$40.00')).toBeInTheDocument();
  });

  it('renders optional tag badges (bestseller / new / one of one / bundle)', () => {
    renderView();
    // Tag badges have a distinctive class — query by class to disambiguate
    // from category labels (the combo SKU has both `tag: 'bundle'` and
    // `category: 'bundle'`).
    const tagBadges = Array.from(document.querySelectorAll('article .absolute')).filter((el) =>
      el.className.includes('right-2 top-2'),
    );
    const tagText = tagBadges.map((el) => el.textContent?.trim());
    expect(tagText).toContain('bestseller');
    expect(tagText).toContain('new');
    expect(tagText).toContain('one of one');
    expect(tagText).toContain('bundle');
  });

  it('each product card links to its detail page', () => {
    renderView();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/demo/ecommerce/tuna-plush-classic');
    expect(hrefs).toContain('/demo/ecommerce/tuna-calendar-2026');
    expect(hrefs).toContain('/demo/ecommerce/colin-plush');
  });

  it('clicking add-to-cart fires trackAddToCart with the product', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderView();
    const addButtons = document.querySelectorAll('button[aria-label*="Add"]');
    expect(addButtons.length).toBe(6);
    await user.click(addButtons[0]);
    expect(mockAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 'tuna-plush-classic', product_price: 26 }),
    );
  });

  it('fires the three-toast cascade on mount with the prototype timing', () => {
    renderView();
    // ~700ms → session_start
    act(() => {
      jest.advanceTimersByTime(750);
    });
    expect(screen.getByText('session_start')).toBeInTheDocument();
    // ~1.9s → taxonomy_classified
    act(() => {
      jest.advanceTimersByTime(1300);
    });
    expect(screen.getByText('taxonomy_classified')).toBeInTheDocument();
    // ~3.6s → view_item_list
    act(() => {
      jest.advanceTimersByTime(1800);
    });
    expect(screen.getByText('view_item_list')).toBeInTheDocument();
  });

  it('session_start toast carries the resolved utm_campaign in the detail line', () => {
    mockSearchParams = new URLSearchParams({ utm_campaign: 'tiktok_creative_unboxing_v3' });
    renderView();
    act(() => {
      jest.advanceTimersByTime(750);
    });
    const sessionStartCard = Array.from(document.querySelectorAll('[data-toast-card]')).find((c) =>
      c.textContent?.includes('session_start'),
    ) as HTMLElement;
    expect(sessionStartCard).toBeTruthy();
    expect(sessionStartCard.textContent).toContain('tiktok_creative_unboxing_v3');
  });

  it('taxonomy_classified toast carries the classified bucket', () => {
    mockSearchParams = new URLSearchParams({ utm_campaign: 'google_brand_tuna' });
    renderView();
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    const taxonomyCard = Array.from(document.querySelectorAll('[data-toast-card]')).find((c) =>
      c.textContent?.includes('taxonomy_classified'),
    ) as HTMLElement;
    expect(taxonomyCard.textContent).toContain('Brand · Search');
  });

  it('view_item_list toast carries the product count', () => {
    renderView();
    act(() => {
      jest.advanceTimersByTime(3700);
    });
    const listCard = Array.from(document.querySelectorAll('[data-toast-card]')).find((c) =>
      c.textContent?.includes('view_item_list'),
    ) as HTMLElement;
    expect(listCard.textContent).toContain('count=6');
  });

  // UAT r1 item 4 — the `all · plush · calendar · cameo · bundles`
  // row read as a filter control but filtering 6 products has no value.
  // Remove it to stop drawing attention to pointless UI.
  it('does NOT render the pointless filter-chip row (UAT r1 item 4)', () => {
    renderView();
    const labels = ['plush', 'calendar', 'cameo', 'bundles'];
    for (const label of labels) {
      // Each token previously rendered as its own <span>, so the DOM
      // surface we're killing is the exact-text span inside the
      // listing header. Query for the chip span explicitly rather
      // than the substring (which would match the product blurbs).
      const matches = Array.from(document.querySelectorAll('span')).filter(
        (el) => el.textContent?.trim().toLowerCase() === label,
      );
      expect(matches).toHaveLength(0);
    }
  });

  it('cascade fires exactly once across re-renders (no duplicate toasts)', () => {
    const { rerender } = renderView();
    rerender(
      <ToastProvider>
        <CartProvider>
          <ListingView />
        </CartProvider>
      </ToastProvider>,
    );
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    const sessionStartCards = Array.from(document.querySelectorAll('[data-toast-card]')).filter(
      (c) => c.textContent?.includes('session_start'),
    );
    expect(sessionStartCards.length).toBeLessThanOrEqual(1);
  });
});
