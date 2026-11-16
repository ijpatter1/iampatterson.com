/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

import { EcomFooter } from '@/components/demo/ecommerce/ecom-footer';

// Metabase is retired (18.3). The shop footer on every shop page must not
// promise that a visitor's clicks reach a dashboard.
describe('EcomFooter', () => {
  it('claims no dashboard', () => {
    const { container } = render(<EcomFooter />);
    expect(container.textContent).toMatch(/production measurement stack/);
    expect(container.textContent).not.toMatch(/dashboard/i);
  });
});
