/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

import EcommerceLayout from '@/app/demo/ecommerce/layout';

jest.mock('next/navigation', () => ({
  usePathname: () => '/demo/ecommerce',
}));

describe('EcommerceLayout — Tuna Shop brand scope', () => {
  it('renders a wrapper with data-demo="ecommerce" so the palette override applies', () => {
    const { container } = render(
      <EcommerceLayout>
        <div>child</div>
      </EcommerceLayout>,
    );
    const scope = container.querySelector('[data-demo="ecommerce"]');
    expect(scope).not.toBeNull();
    expect(scope?.textContent).toContain('child');
  });

  it('scope wrapper contains the cart provider so cart access works inside', () => {
    // Children rendered inside the scope should be inside the CartProvider.
    // If CartProvider were outside the scope, the palette override wouldn't
    // apply to elements rendered via cart context. We assert structurally by
    // verifying data-demo is on the OUTERMOST element.
    const { container } = render(
      <EcommerceLayout>
        <div>child</div>
      </EcommerceLayout>,
    );
    const outer = container.firstElementChild;
    expect(outer?.getAttribute('data-demo')).toBe('ecommerce');
  });

  // UAT r2 item 7 — "this is a demo" used to live only in the footer;
  // visitors who didn't scroll missed it. Moved to a persistent top banner.
  describe('UAT r2 item 7 — persistent top demo banner', () => {
    it('renders the EcomDemoBanner above the sub-nav', () => {
      const { container } = render(
        <EcommerceLayout>
          <div>child</div>
        </EcommerceLayout>,
      );
      const banner = container.querySelector('[data-ecom-demo-banner]');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toMatch(/this is a demo/i);
      // Order: banner must come before the ecom sub-nav.
      const subNav = container.querySelector('nav');
      expect(
        banner?.compareDocumentPosition(subNav as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('banner uses the terminal amber-on-near-black palette', () => {
      const { container } = render(
        <EcommerceLayout>
          <div>child</div>
        </EcommerceLayout>,
      );
      const banner = container.querySelector('[data-ecom-demo-banner]') as HTMLElement;
      expect(banner.className).toMatch(/#0D0B09|bg-\[#0D0B09\]/i);
      expect(banner.textContent).toMatch(/nothing ships/i);
    });

    it('footer NO LONGER carries the duplicate "this is a demo" eyebrow', () => {
      const { container } = render(
        <EcommerceLayout>
          <div>child</div>
        </EcommerceLayout>,
      );
      const footer = container.querySelector('footer');
      expect(footer).not.toBeNull();
      // The mission paragraph survives; the eyebrow is gone.
      expect(footer?.textContent).toMatch(/The tuna shop is a working storefront/);
      // The eyebrow-shaped "this is a demo" label should not appear inside
      // the footer (it still renders via the top banner elsewhere in the
      // layout, but not here).
      const eyebrowInsideFooter = Array.from(footer?.querySelectorAll('div') ?? []).find(
        (el) => el.textContent?.trim().toLowerCase() === 'this is a demo',
      );
      expect(eyebrowInsideFooter).toBeUndefined();
    });
  });
});
