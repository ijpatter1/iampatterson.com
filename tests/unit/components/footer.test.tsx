/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Footer } from '@/components/footer';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
import { CONTACT_EMAIL } from '@/lib/content/contact';
import { PRACTICE_NAME } from '@/lib/seo/site';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trackClickNav, trackClickCta } = require('@/lib/events/track') as {
  trackClickNav: jest.Mock;
  trackClickCta: jest.Mock;
};

function Probe() {
  const { isOpen, pendingTab } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? `open:${pendingTab}` : 'closed'}</span>;
}

function renderFooter() {
  return render(
    <OverlayProvider>
      <Footer />
      <Probe />
    </OverlayProvider>,
  );
}

const footer = () => screen.getByRole('contentinfo');

// 15.4: one row, as copy.md §Footer and the bundle corrections set it out:
// the copyright, the address, Contact, the Session links and the stack line.
describe('Footer, one row (15.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The practice was renamed in 15.9; the copyright reads the one constant.
  it('carries the copyright in the practice name', () => {
    renderFooter();
    expect(within(footer()).getByText(`© 2026 ${PRACTICE_NAME}`)).toBeInTheDocument();
    expect(footer().textContent).not.toMatch(/Patterson Consulting/);
  });

  it('shows the contact address and fires one click_cta with the footer email location', async () => {
    const user = userEvent.setup();
    renderFooter();
    const email = within(footer()).getByRole('link', { name: CONTACT_EMAIL });
    expect(email).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    email.addEventListener('click', (e) => e.preventDefault());
    await user.click(email);
    expect(trackClickCta).toHaveBeenCalledTimes(1);
    expect(trackClickCta).toHaveBeenCalledWith(CONTACT_EMAIL, 'footer_email');
    expect(trackClickNav).not.toHaveBeenCalled();
  });

  it('links to /contact and fires one click_cta with the footer contact location', async () => {
    const user = userEvent.setup();
    renderFooter();
    const contact = within(footer()).getByRole('link', { name: /^contact$/i });
    expect(contact).toHaveAttribute('href', '/contact');
    contact.addEventListener('click', (e) => e.preventDefault());
    await user.click(contact);
    expect(trackClickCta).toHaveBeenCalledTimes(1);
    expect(trackClickCta).toHaveBeenCalledWith('Contact', 'footer_contact');
    expect(trackClickNav).not.toHaveBeenCalled();
  });

  // Each Session label opens the overlay on its own tab, as the old footer's
  // Session column did, and reports it under footer_session.
  it.each([
    ['Overview', 'overview'],
    ['Live event stream', 'timeline'],
    ['Consent state', 'consent'],
  ])('opens the overlay on the matching tab from "%s"', async (label, tab) => {
    const user = userEvent.setup();
    renderFooter();
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('closed');
    await user.click(within(footer()).getByRole('button', { name: label }));
    expect(screen.getByTestId('overlay-status')).toHaveTextContent(`open:${tab}`);
    expect(trackClickCta).toHaveBeenCalledTimes(1);
    expect(trackClickCta).toHaveBeenCalledWith(label, 'footer_session');
  });

  it('labels the Session links and carries the stack line', () => {
    renderFooter();
    expect(footer().textContent).toMatch(/Session:\s*Overview · Live event stream · Consent state/);
    expect(
      within(footer()).getByText('Built on Next.js · GTM · sGTM · BigQuery · Dataform'),
    ).toBeInTheDocument();
  });

  // The items, in copy.md's order, in one mono 10px row. The Session links
  // replace the old display-only readout, and the wordmark isn't in the row.
  it('lays the items out in order in one mono 10px row', () => {
    renderFooter();
    const row = footer().querySelector('[data-footer-row]')!;
    expect(row.className).toMatch(/font-mono/);
    expect(row.className).toMatch(/text-\[10px\]/);
    const text = row.textContent!;
    const order = [
      `© 2026 ${PRACTICE_NAME}`,
      CONTACT_EMAIL,
      'Contact',
      'Session:',
      'Built on Next.js',
    ].map((s) => text.indexOf(s));
    for (const i of order) expect(i).toBeGreaterThanOrEqual(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).not.toMatch(/evt/);
  });

  it('gives every link and button a 44px target', () => {
    renderFooter();
    const targets = [
      ...within(footer()).getAllByRole('link'),
      ...within(footer()).getAllByRole('button'),
    ];
    expect(targets).toHaveLength(5);
    for (const t of targets) expect(t.className).toMatch(/min-h-\[44px\]/);
  });

  // A heading in the footer would sit outside every page's outline.
  it('has no headings', () => {
    renderFooter();
    expect(within(footer()).queryAllByRole('heading')).toHaveLength(0);
  });

  // The Pages and Demos columns stay gone: no demo link, no services link, and
  // none of the old offer's words.
  it('has no demo or services link and none of the old positioning', () => {
    renderFooter();
    expect(footer().querySelector('a[href^="/demo"]')).toBeNull();
    expect(footer().querySelector('a[href="/services"]')).toBeNull();
    expect(footer().textContent).not.toMatch(
      /\btiers?\b|measurement infrastructure|\bdemos?\b|tuna shop|metabase/i,
    );
  });
});
