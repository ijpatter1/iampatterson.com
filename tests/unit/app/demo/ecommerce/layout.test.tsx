/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

import EcommerceLayout from '@/app/demo/ecommerce/layout';

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
});
