/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import HomePage from '@/app/page';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

const mockOpen = jest.fn();
jest.mock('@/components/overlay/overlay-context', () => ({
  useOverlay: () => ({
    isOpen: false,
    toggle: jest.fn(),
    open: mockOpen,
    close: jest.fn(),
  }),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
      ...rest
    }: {
      children: React.ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => {
      const filtered: Record<string, unknown> = {};
      const skip = new Set([
        'initial',
        'animate',
        'exit',
        'transition',
        'variants',
        'whileInView',
        'viewport',
        'onAnimationComplete',
      ]);
      for (const [k, v] of Object.entries(rest)) {
        if (!skip.has(k)) filtered[k] = v;
      }
      return (
        <div className={className} {...filtered}>
          {children}
        </div>
      );
    },
  },
  useReducedMotion: () => false,
}));

import { trackClickCta } from '@/lib/events/track';

const mockTrackClickCta = trackClickCta as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HomePage', () => {
  describe('Hero section', () => {
    it('renders the hero heading', () => {
      render(<HomePage />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        /I build measurement infrastructure/i,
      );
    });

    it('describes the live stack running on this site', () => {
      render(<HomePage />);
      expect(screen.getByText(/this site runs on the same stack I sell/i)).toBeInTheDocument();
    });

    it('renders the "See what\'s underneath" hero CTA that opens the overlay', async () => {
      const user = userEvent.setup();
      render(<HomePage />);
      const btn = screen.getByRole('button', { name: /see what.*s underneath/i });
      await user.click(btn);
      expect(mockOpen).toHaveBeenCalled();
      expect(mockTrackClickCta).toHaveBeenCalledWith("See what's underneath", 'hero');
    });

    it('renders the "Explore the demos" CTA linking to #demos', () => {
      render(<HomePage />);
      expect(screen.getByRole('link', { name: /explore the demos/i })).toHaveAttribute(
        'href',
        '#demos',
      );
    });
  });

  describe('Pipeline CTA section', () => {
    it('renders a compact pipeline path', () => {
      render(<HomePage />);
      expect(screen.getByText('Browser')).toBeInTheDocument();
      expect(screen.getByText('sGTM')).toBeInTheDocument();
      expect(screen.getByText('BigQuery')).toBeInTheDocument();
    });

    it('renders the pipeline section heading', () => {
      render(<HomePage />);
      expect(screen.getAllByText(/see what.*s running underneath/i).length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('renders the "Look under the hood" button that opens the overlay', async () => {
      const user = userEvent.setup();
      render(<HomePage />);
      const btn = screen.getByRole('button', { name: /look under the hood/i });
      await user.click(btn);
      expect(mockOpen).toHaveBeenCalled();
    });
  });

  describe('Demos intro', () => {
    it('renders the demos section heading', () => {
      render(<HomePage />);
      expect(screen.getByText(/three business models/i)).toBeInTheDocument();
    });

    it('renders the demos intro copy', () => {
      render(<HomePage />);
      expect(
        screen.getByText(/each demo below is a fully functional front-end/i),
      ).toBeInTheDocument();
    });
  });

  describe('Demo spotlight sections', () => {
    it('renders three full-width demo spotlight sections', () => {
      render(<HomePage />);
      expect(screen.getByText('The Tuna Shop')).toBeInTheDocument();
      expect(screen.getByText('Tuna Subscription')).toBeInTheDocument();
      expect(screen.getByText('Tuna Partnerships')).toBeInTheDocument();
    });

    it('links each demo section to its demo page', () => {
      render(<HomePage />);
      expect(screen.getByRole('link', { name: /explore the tuna shop/i })).toHaveAttribute(
        'href',
        '/demo/ecommerce',
      );
      expect(screen.getByRole('link', { name: /explore tuna subscription/i })).toHaveAttribute(
        'href',
        '/demo/subscription',
      );
      expect(screen.getByRole('link', { name: /explore tuna partnerships/i })).toHaveAttribute(
        'href',
        '/demo/leadgen',
      );
    });

    it('shows demo type labels', () => {
      render(<HomePage />);
      expect(screen.getByText('E-Commerce')).toBeInTheDocument();
      expect(screen.getByText('Subscription')).toBeInTheDocument();
      expect(screen.getByText('Lead Generation')).toBeInTheDocument();
    });
  });
});
