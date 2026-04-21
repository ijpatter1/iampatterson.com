/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider, useToast } from '@/components/demo/reveal/toast-provider';

function PushButton({
  label = 'push',
  toast,
}: {
  label?: string;
  toast: Parameters<ReturnType<typeof useToast>['push']>[0];
}) {
  const { push } = useToast();
  return <button onClick={() => push(toast)}>{label}</button>;
}

function ClearButton() {
  const { clear } = useToast();
  return <button onClick={clear}>clear</button>;
}

describe('ToastProvider + useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders children and the portal root', () => {
    render(
      <ToastProvider>
        <div>child</div>
      </ToastProvider>,
    );
    expect(screen.getByText('child')).toBeInTheDocument();
    const portal = document.querySelector('[data-toast-portal]');
    expect(portal).not.toBeNull();
    expect(portal?.getAttribute('aria-live')).toBe('polite');
    expect(portal?.getAttribute('aria-atomic')).toBe('false');
  });

  it('throws when useToast is called outside ToastProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<PushButton toast={{ event_name: 'x' }} />)).toThrow(
      'useToast must be used within a ToastProvider',
    );
    spy.mockRestore();
  });

  it('push() shows the toast with event_name, detail, and routing', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton
          toast={{
            event_name: 'add_to_cart',
            detail: 'item_id=tuna-plush  value=26',
            routing: ['GA4', 'BigQuery'],
          }}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    expect(screen.getByText('add_to_cart')).toBeInTheDocument();
    expect(
      screen.getByText('item_id=tuna-plush  value=26', { normalizer: (s) => s }),
    ).toBeInTheDocument();
    expect(screen.getByText('GA4')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
  });

  it('auto-dismisses after the default duration (~3200ms)', async () => {
    // UAT r1 item 9, default duration bumped 2400 → 3200ms so
    // readers have a full read + reaction window; pre-rework toasts
    // felt "abrupt" partly because they vanished too fast.
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton toast={{ event_name: 'product_view' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    expect(screen.getByText('product_view')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(3199);
    });
    expect(screen.queryByText('product_view')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(screen.queryByText('product_view')).not.toBeInTheDocument();
  });

  it('honours per-toast duration override', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton toast={{ event_name: 'view_cart', duration: 800 }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    act(() => {
      jest.advanceTimersByTime(799);
    });
    expect(screen.queryByText('view_cart')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(screen.queryByText('view_cart')).not.toBeInTheDocument();
  });

  it('stacks up to 3 toasts; the oldest is dropped when a 4th arrives', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton label="A" toast={{ event_name: 'evt_a' }} />
        <PushButton label="B" toast={{ event_name: 'evt_b' }} />
        <PushButton label="C" toast={{ event_name: 'evt_c' }} />
        <PushButton label="D" toast={{ event_name: 'evt_d' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('A'));
    await user.click(screen.getByText('B'));
    await user.click(screen.getByText('C'));
    expect(screen.getByText('evt_a')).toBeInTheDocument();
    expect(screen.getByText('evt_b')).toBeInTheDocument();
    expect(screen.getByText('evt_c')).toBeInTheDocument();
    await user.click(screen.getByText('D'));
    // Oldest (A) dropped; B, C, D remain
    expect(screen.queryByText('evt_a')).not.toBeInTheDocument();
    expect(screen.getByText('evt_b')).toBeInTheDocument();
    expect(screen.getByText('evt_c')).toBeInTheDocument();
    expect(screen.getByText('evt_d')).toBeInTheDocument();
  });

  it('newest toast renders first (top of the stack)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton label="A" toast={{ event_name: 'evt_a' }} />
        <PushButton label="B" toast={{ event_name: 'evt_b' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('A'));
    await user.click(screen.getByText('B'));
    const portal = document.querySelector('[data-toast-portal]') as HTMLElement;
    const cards = portal.querySelectorAll('[data-toast-card]');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('evt_b'); // newest first
    expect(cards[1].textContent).toContain('evt_a');
  });

  it('clear() removes all in-flight toasts immediately', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton label="A" toast={{ event_name: 'evt_a' }} />
        <PushButton label="B" toast={{ event_name: 'evt_b' }} />
        <ClearButton />
      </ToastProvider>,
    );
    await user.click(screen.getByText('A'));
    await user.click(screen.getByText('B'));
    expect(screen.getByText('evt_a')).toBeInTheDocument();
    expect(screen.getByText('evt_b')).toBeInTheDocument();
    await user.click(screen.getByText('clear'));
    expect(screen.queryByText('evt_a')).not.toBeInTheDocument();
    expect(screen.queryByText('evt_b')).not.toBeInTheDocument();
  });

  it('applies the position prop as a data attribute on the toast card', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton
          label="near-cart"
          toast={{ event_name: 'add_to_cart', position: 'near-cart' }}
        />
        <PushButton
          label="viewport-top"
          toast={{ event_name: 'session_start', position: 'viewport-top' }}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByText('near-cart'));
    await user.click(screen.getByText('viewport-top'));
    const cards = document.querySelectorAll('[data-toast-card]');
    const positions = Array.from(cards).map((c) => c.getAttribute('data-position'));
    expect(positions).toContain('near-cart');
    expect(positions).toContain('viewport-top');
  });

  it('default position is viewport-top when none is provided', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton toast={{ event_name: 'evt_a' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    const card = document.querySelector('[data-toast-card]');
    expect(card?.getAttribute('data-position')).toBe('viewport-top');
  });

  it('toast card has role="status" so screen readers announce it without focus stealing', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton toast={{ event_name: 'page_view' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    const card = document.querySelector('[data-toast-card]');
    expect(card?.getAttribute('role')).toBe('status');
  });

  it('renders the > prompt glyph and → routing arrow', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton
          toast={{
            event_name: 'product_view',
            routing: ['GA4'],
          }}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    const card = document.querySelector('[data-toast-card]');
    expect(card?.textContent).toContain('>');
    expect(card?.textContent).toContain('→');
  });

  it('omits routing line when routing array is missing or empty', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton label="no-routing" toast={{ event_name: 'evt_no_route' }} />
        <PushButton label="empty-routing" toast={{ event_name: 'evt_empty_route', routing: [] }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('no-routing'));
    await user.click(screen.getByText('empty-routing'));
    const cards = document.querySelectorAll('[data-toast-card]');
    cards.forEach((c) => expect(c.textContent).not.toContain('→'));
  });

  it('omits detail line when detail is missing', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton toast={{ event_name: 'evt_a' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    const card = document.querySelector('[data-toast-card]');
    // Detail-line element should not exist; the only text is event_name + prompt
    expect(card?.querySelector('[data-toast-detail]')).toBeNull();
  });

  it('cleans up timers on unmount (no act warnings, no orphaned toasts)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { unmount } = render(
      <ToastProvider>
        <PushButton toast={{ event_name: 'evt_a' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    unmount();
    // Advancing timers after unmount should not throw or produce updates.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(document.querySelector('[data-toast-portal]')).toBeNull();
  });

  it('reduced-motion sets data-reduced-motion="true" on the portal', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    render(
      <ToastProvider>
        <div>child</div>
      </ToastProvider>,
    );
    const portal = document.querySelector('[data-toast-portal]');
    expect(portal?.getAttribute('data-reduced-motion')).toBe('true');
  });

  // UAT r1 item 9, pre-rework toasts appeared abruptly (no entry
  // motion), which made them feel like the site was bugging out. The
  // card applies a `motion-safe:animate-toast-enter` class so the
  // reveal is a deliberate slide+fade for motion-tolerant visitors
  // and an instant appearance under `prefers-reduced-motion: reduce`.
  describe('UAT r1 item 9, intentional toast entry', () => {
    it('card has motion-safe entry animation class', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(
        <ToastProvider>
          <PushButton toast={{ event_name: 'evt_a' }} />
        </ToastProvider>,
      );
      await user.click(screen.getByText('push'));
      const card = document.querySelector('[data-toast-card]') as HTMLElement;
      expect(card.className).toMatch(/motion-safe:animate-toast-enter/);
    });

    it('portal region repositions to top-right at md breakpoint (desktop inbox pattern)', () => {
      render(
        <ToastProvider>
          <div>child</div>
        </ToastProvider>,
      );
      const portal = document.querySelector('[data-toast-portal]') as HTMLElement;
      // Mobile keeps centered-at-top (best for narrow viewports);
      // desktop moves to the top-right corner so the toast does not
      // dominate the horizontal center of the page.
      expect(portal.className).toMatch(/inset-x-0/);
      expect(portal.className).toMatch(/top-4/);
      expect(portal.className).toMatch(/md:inset-x-auto/);
      expect(portal.className).toMatch(/md:right-/);
      expect(portal.className).toMatch(/md:items-end/);
    });
  });

  it('reduced-motion: lifetime preserved (toast still dismisses at duration)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <PushButton toast={{ event_name: 'evt_a', duration: 1000 }} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('push'));
    expect(screen.getByText('evt_a')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1001);
    });
    expect(screen.queryByText('evt_a')).not.toBeInTheDocument();
  });
});
