/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProductDetail } from '@/components/demo/ecommerce/product-detail';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';
import { CartProvider } from '@/components/demo/ecommerce/cart-context';
import { getProduct } from '@/lib/demo/products';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/ecommerce/tuna-plush-classic',
}));

const mockProductView = jest.fn();
const mockAddToCart = jest.fn();
jest.mock('@/lib/events/track', () => ({
  trackProductView: (...a: unknown[]) => mockProductView(...a),
  trackAddToCart: (...a: unknown[]) => mockAddToCart(...a),
}));

// Live session context — mocked so the product-detail sidebar can
// prove it's threading real values through (UAT r1 item 6).
const mockSession = jest.fn();
jest.mock('@/hooks/useSessionContext', () => ({
  useSessionContext: () => mockSession(),
}));
const DEFAULT_SESSION = {
  session_id: '',
  last_event_name: '',
  last_event_at: '',
  seconds_since_last_event: 0,
  events_in_session: 0,
  add_to_cart_in_last_30s: 0,
  consent_analytics: false,
  consent_marketing: false,
};

function renderDetail(productId = 'tuna-plush-classic') {
  const product = getProduct(productId)!;
  return render(
    <ToastProvider>
      <CartProvider>
        <ProductDetail product={product} />
      </CartProvider>
    </ToastProvider>,
  );
}

describe('ProductDetail (Phase 9F D6)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockProductView.mockClear();
    mockAddToCart.mockClear();
    mockSession.mockReturnValue(DEFAULT_SESSION);
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders product name, category, price, and blurb', () => {
    renderDetail();
    expect(screen.getByText('Tuna Plush')).toBeInTheDocument();
    expect(screen.getByText('plush')).toBeInTheDocument();
    // Price appears in both the info panel and inside the add-to-cart button
    expect(screen.getAllByText('$26.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/moldable body, bendable legs/i)).toBeInTheDocument();
  });

  it('fires trackProductView once on mount', () => {
    renderDetail();
    expect(mockProductView).toHaveBeenCalledTimes(1);
    expect(mockProductView).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'tuna-plush-classic',
        product_name: 'Tuna Plush',
        product_price: 26,
        product_category: 'plush',
      }),
    );
  });

  it('fires a product_view toast shortly after mount', () => {
    renderDetail();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const toast = document.querySelector('[data-toast-card]');
    expect(toast?.textContent).toContain('product_view');
    expect(toast?.textContent).toContain('tuna-plush-classic');
  });

  it('renders the staging-layer LiveSidebar with raw → typed cast rows', () => {
    renderDetail();
    const sidebar = document.querySelector('aside[data-live-sidebar]');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.textContent).toMatch(/raw.*typed/i);
    // product_id row should include the current product id
    expect(sidebar?.textContent).toContain('"tuna-plush-classic"');
    // product_price row should include FLOAT64 cast
    expect(sidebar?.textContent).toContain('FLOAT64');
  });

  it('staging sidebar shows the 4-op stitch checklist with [OK] tags', () => {
    renderDetail();
    const sidebar = document.querySelector('aside[data-live-sidebar]');
    expect(sidebar?.textContent).toContain('dedupe');
    expect(sidebar?.textContent).toContain('session_stitch');
    expect(sidebar?.textContent).toContain('param_extract');
    expect(sidebar?.textContent).toContain('geo_enrich');
    const okTags = sidebar?.querySelectorAll('[data-status="OK"]');
    expect(okTags?.length).toBeGreaterThanOrEqual(4);
  });

  it('add-to-cart button fires trackAddToCart + updates cart + fires toast', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderDetail();
    // Advance past the product_view toast window so the add_to_cart toast
    // is the freshly-fired one we're inspecting. The product_view toast from
    // mount may still be on-screen but it's a different toast.
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const addButton = document.querySelector('button[aria-label*="Add"]') as HTMLButtonElement;
    expect(addButton).not.toBeNull();
    await user.click(addButton);
    expect(mockAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'tuna-plush-classic',
        product_price: 26,
        quantity: 1,
      }),
    );
    const addCartToast = Array.from(document.querySelectorAll('[data-toast-card]')).find((c) =>
      c.textContent?.includes('add_to_cart'),
    );
    expect(addCartToast).toBeTruthy();
  });

  it('renders a back-to-shop breadcrumb link', () => {
    renderDetail();
    const backLink = screen.getByRole('link', { name: /back to the shop/i });
    expect(backLink.getAttribute('href')).toBe('/demo/ecommerce');
  });

  it('renders related products rail with up to 3 other products', () => {
    renderDetail('tuna-plush-classic');
    // Other products' names should appear as links
    const links = Array.from(screen.getAllByRole('link'));
    const hrefs = links.map((l) => l.getAttribute('href'));
    const relatedHrefs = hrefs.filter(
      (h) =>
        h?.startsWith('/demo/ecommerce/') &&
        h !== '/demo/ecommerce' &&
        h !== '/demo/ecommerce/tuna-plush-classic',
    );
    expect(relatedHrefs.length).toBeGreaterThanOrEqual(1);
  });

  it('product_view toast uses near-product position', () => {
    renderDetail();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const toast = document.querySelector('[data-toast-card]') as HTMLElement;
    expect(toast.getAttribute('data-position')).toBe('near-product');
  });

  it('staging sidebar title includes the event name', () => {
    renderDetail();
    const sidebar = document.querySelector('aside[data-live-sidebar]');
    expect(sidebar?.textContent).toMatch(/product_view/);
  });

  // UAT r1 item 6 — the staging-layer sidebar was advertised as live but
  // rendered hardcoded session_id / event_timestamp / event count. With
  // live session context present, those fields must substitute.
  describe('UAT r1 item 6 — live staging-layer readout', () => {
    it("substitutes the visitor's real session_id into the session_id row", () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        session_id: 'abc12345-6789-4def-8abc-deadbeefcafe',
        events_in_session: 3,
      });
      renderDetail();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/abc12345…/);
    });

    it('substitutes the real last_event_at into the event_timestamp row', () => {
      const ts = '2026-04-21T18:15:02.000Z';
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        last_event_at: ts,
      });
      renderDetail();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toContain(ts);
    });

    it('session_stitch detail reflects the real session_id + event count', () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        session_id: 'abc12345-6789-4def-8abc-deadbeefcafe',
        events_in_session: 7,
      });
      renderDetail();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/linked to abc12345… \(7 events\)/);
    });

    it('renders the seed placeholders when live session is empty (pre-first-event / SSR)', () => {
      renderDetail();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      // Seed session_id row renders the prototype "ses_x9b2…" placeholder.
      expect(sidebar?.textContent).toMatch(/ses_x9b2/);
    });
  });

  // UAT r1 item 7 — the palette swatch row under the product blurb
  // was a design reference in the hi-fi prototype, not intended as
  // shipped UI. Remove it.
  it('does NOT render a "palette" swatch row under the blurb (UAT r1 item 7)', () => {
    renderDetail();
    // Kill the specific mono-uppercase "palette" label inside the
    // info panel. The product's colored hero tile (which also uses
    // palette colors) is the intended imagery — that stays.
    const paletteLabels = Array.from(document.querySelectorAll('span')).filter(
      (el) => el.textContent?.trim().toLowerCase() === 'palette',
    );
    expect(paletteLabels).toHaveLength(0);
  });
});
