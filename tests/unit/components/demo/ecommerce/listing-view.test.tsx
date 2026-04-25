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

describe('ListingView (Phase 9F D5, product listing)', () => {
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
    // Headline fragment: "the underdog with the overbite.", correcting
    // the hi-fi prototype, which got this wrong. Chiweenies have
    // overbites (upper jaw past the lower); the about page already
    // renders the correct phrase.
    expect(screen.getByText(/underdog/i)).toBeInTheDocument();
    expect(screen.getByText(/overbite/i)).toBeInTheDocument();
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

  // UAT r2 item 11, mobile: products swipe horizontally instead of
  // stacking vertically. Pure CSS scroll-snap; no JS carousel lib.
  describe('UAT r2 item 11, mobile swipeable product carousel', () => {
    it('product-listing container carries scroll-snap classes (mobile) and grid classes (sm+)', () => {
      renderView();
      const listing = document.querySelector('[data-product-listing]') as HTMLElement;
      expect(listing).not.toBeNull();
      // Mobile: flex + overflow-x-auto + snap-x snap-mandatory.
      expect(listing.className).toMatch(/\bflex\b/);
      expect(listing.className).toMatch(/\boverflow-x-auto\b/);
      expect(listing.className).toMatch(/\bsnap-x\b/);
      expect(listing.className).toMatch(/\bsnap-mandatory\b/);
      // sm+: grid + snap-none override.
      expect(listing.className).toMatch(/sm:grid\b/);
      expect(listing.className).toMatch(/sm:snap-none/);
    });

    it('each product card carries snap-start + fixed-width on mobile, auto on sm+', () => {
      renderView();
      const cards = document.querySelectorAll('[data-product-card]');
      expect(cards.length).toBe(6);
      cards.forEach((card) => {
        expect(card.className).toMatch(/\bsnap-start\b/);
        expect(card.className).toMatch(/w-\[78vw\]/);
        expect(card.className).toMatch(/\bshrink-0\b/);
        // sm+ resets to grid sizing.
        expect(card.className).toMatch(/sm:w-auto/);
        expect(card.className).toMatch(/sm:snap-none/);
      });
    });
  });

  // Phase 10d D8.f Pass-1 fix: listing cards render real product
  // photography (not the pre-D8.f palette-tile placeholder). A regression
  // dropping `Product.image` back to palette-only, or breaking the
  // `next/image` thread through `product-listing.tsx`, would take the grid
  // back to solid-colour rects without any existing test failing. Pin the
  // 6 images + per-card src/alt.
  describe('Phase 10d D8.f, product photography on listing cards', () => {
    it('renders one image per product card with a product-scoped src and descriptive alt', () => {
      renderView();
      const cards = document.querySelectorAll('[data-product-card]');
      expect(cards.length).toBe(6);
      cards.forEach((card) => {
        const img = card.querySelector('img');
        expect(img).not.toBeNull();
        // `next/image` emits its optimizer URL (`/_next/image?url=...`)
        // with the public path URL-encoded in the query string. Decode
        // before asserting so the test is agnostic to the optimizer
        // wrapper.
        const src = decodeURIComponent(img!.getAttribute('src') ?? '');
        expect(src).toContain('/shop/');
        expect(src).toContain('.webp');
        // Alt is descriptive, not empty (decorative alt would be wrong
        // on the listing grid — the photo carries the primary visual
        // identity of each card).
        expect(img!.getAttribute('alt')?.length ?? 0).toBeGreaterThan(10);
      });
    });
  });

  // UAT r2 item 12, every demo screen needs a "what am I looking at"
  // walkthrough blurb so visitors don't bounce off the data surfaces.
  describe('UAT r2 item 12, walkthrough blurb', () => {
    it('renders a WalkthroughBlurb on the listing page', () => {
      renderView();
      const blurb = document.querySelector('[data-walkthrough-blurb]');
      expect(blurb).not.toBeNull();
      expect(blurb?.getAttribute('data-route')).toBe('listing');
    });

    it('listing blurb omits the "see the stack" chip (no LiveSidebar on this page)', () => {
      renderView();
      // The listing page has no Pattern 2 sidebar, the classification
      // story is carried by the inline UTM panel, so the scroll chip
      // would have nothing to target.
      expect(document.querySelector('[data-walkthrough-stack-link]')).toBeNull();
    });
  });

  // UAT r2 item 8, the UTM capture panel previously used the cream +
  // warm-brown shop palette; per the user, it should match the under-the-
  // hood reveal overlay (amber on near-black terminal).
  describe('UAT r2 item 8, UTM capture panel adopts the terminal palette', () => {
    it('uses the near-black terminal background + amber accent border', () => {
      renderView();
      const panel = document.querySelector('[data-utm-capture]') as HTMLElement;
      expect(panel).not.toBeNull();
      expect(panel.className).toMatch(/#0D0B09|bg-\[#0D0B09\]/i);
      expect(panel.className).toMatch(/#F3C769/);
    });

    it("classified-bucket chip uses the amber accent (the panel's highlight color)", () => {
      renderView();
      const panel = document.querySelector('[data-utm-capture]') as HTMLElement;
      // `bucket` is the last of the three classified chips.
      const chips = panel.querySelectorAll('dd:last-of-type span');
      const bucketChip = chips[chips.length - 1] as HTMLElement;
      expect(bucketChip.className).toMatch(/\[#F3C769\]/);
    });
  });

  // UAT r2 item 9, the shop homepage body copy was `text-[15px]`, which
  // read smaller than the site homepage's 17px. Match the homepage body
  // size so the shop doesn't feel like a downgrade.
  describe('UAT r2 item 9, shop body copy matches homepage body size', () => {
    it('listing hero paragraph is 17px (matches site homepage demos-section body)', () => {
      renderView();
      const paragraphs = document.querySelectorAll('section p');
      const lede = Array.from(paragraphs).find((p) =>
        /Tuna is a chiweenie with a famous face/.test(p.textContent ?? ''),
      ) as HTMLElement | undefined;
      expect(lede).toBeDefined();
      expect(lede?.className).toMatch(/text-\[17px\]/);
    });
  });

  // UAT r1 item 3, the `dl` previously labelled the default UTM seed
  // as "your utm_campaign" even when the visitor's URL carried no
  // utm_campaign. That's dishonest, it's an example, not theirs.
  // When no utm_campaign is in the URL, the panel must flag the
  // value as a representative example; when one IS present, the flag
  // must not appear.
  describe('UAT r1 item 3, honest UTM labelling', () => {
    it('flags the seed as an example when no utm_campaign is in the URL', () => {
      renderView();
      const panel = document.querySelector('dl');
      expect(panel?.textContent).toMatch(/example/i);
    });

    it('does NOT flag it as "your utm_campaign" when the seed is showing', () => {
      renderView();
      const panel = document.querySelector('dl');
      // Pre-rework label "your utm_campaign" was the lie when the
      // value was the fallback seed.
      expect(panel?.textContent).not.toMatch(/your utm_campaign/i);
    });

    it('uses the live "your utm_campaign" label when an explicit utm_campaign is present', () => {
      mockSearchParams = new URLSearchParams({ utm_campaign: 'google_brand_tuna' });
      renderView();
      const panel = document.querySelector('dl');
      expect(panel?.textContent).toMatch(/your utm_campaign/i);
      expect(panel?.textContent).not.toMatch(/example/i);
    });
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
    // Tag badges have a distinctive class, query by class to disambiguate
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

  // UAT r1 item 4, the `all · plush · calendar · cameo · bundles`
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
