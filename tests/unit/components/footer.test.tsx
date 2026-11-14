/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Footer } from '@/components/footer';
import { OverlayProvider } from '@/components/overlay/overlay-context';
import { CONTACT_EMAIL } from '@/lib/content/contact';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trackClickNav, trackClickCta } = require('@/lib/events/track') as {
  trackClickNav: jest.Mock;
  trackClickCta: jest.Mock;
};

function renderFooter() {
  return render(
    <OverlayProvider>
      <Footer />
    </OverlayProvider>,
  );
}

// 15.4: the footer collapses to one row. The site sells one thing, the
// review, and the header already carries the way to it, so the footer keeps
// only the wordmark, the contact page, the address and the session readout.
describe('Footer, one row (15.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The footer has its own Contact link now, so the wordmark goes home, as
  // a wordmark conventionally does.
  it('links the wordmark home and records it as navigation, not a call to action', async () => {
    const user = userEvent.setup();
    renderFooter();
    const wordmark = screen.getByRole('link', { name: /^patterson\s*\.?$/i });
    expect(wordmark).toHaveAttribute('href', '/');
    await user.click(wordmark);
    expect(trackClickNav).toHaveBeenCalledWith('Patterson', '/');
    expect(trackClickCta).not.toHaveBeenCalled();
  });

  // A heading in the footer would sit outside every page's outline (on
  // /contact/thanks it jumped from h1 to h4).
  it('has no headings', () => {
    renderFooter();
    expect(within(screen.getByRole('contentinfo')).queryAllByRole('heading')).toHaveLength(0);
  });

  it('links to /contact and fires one click_cta with the footer contact location', async () => {
    const user = userEvent.setup();
    renderFooter();
    const contact = screen.getByRole('link', { name: /^contact$/i });
    expect(contact).toHaveAttribute('href', '/contact');
    await user.click(contact);
    expect(trackClickCta).toHaveBeenCalledTimes(1);
    expect(trackClickCta).toHaveBeenCalledWith('Contact', 'footer_contact');
    expect(trackClickNav).not.toHaveBeenCalled();
  });

  it('shows the contact address and fires one click_cta with the footer email location', async () => {
    const user = userEvent.setup();
    renderFooter();
    const email = screen.getByRole('link', { name: CONTACT_EMAIL });
    expect(email).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    await user.click(email);
    expect(trackClickCta).toHaveBeenCalledTimes(1);
    expect(trackClickCta).toHaveBeenCalledWith(CONTACT_EMAIL, 'footer_email');
  });

  // The readout stays display-only: the header's pulse is the one that opens
  // the overlay.
  it('keeps the session readout, display-only', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(/evt/)).toBeInTheDocument();
    expect(within(footer).queryByRole('button')).not.toBeInTheDocument();
  });

  it('has exactly three links, each with a 44px target', () => {
    renderFooter();
    const links = within(screen.getByRole('contentinfo')).getAllByRole('link');
    expect(links).toHaveLength(3);
    for (const link of links) expect(link.className).toMatch(/min-h-\[44px\]/);
  });

  // The Pages and Demos columns go: no demo link, no services link, and no
  // copy from the old positioning.
  it('drops the old columns, the demo link and the old tagline', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).queryByRole('link', { name: /tuna shop/i })).not.toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: /^services$/i })).not.toBeInTheDocument();
    expect(footer.querySelector('a[href^="/demo"]')).toBeNull();
    expect(footer.textContent).not.toMatch(
      /tier|measurement infrastructure|demo|tuna shop|metabase/i,
    );
  });
});
