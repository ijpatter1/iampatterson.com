/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import HomePage from '@/app/page';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
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
        'Your marketing data is lying to you.',
      );
    });

    it('renders the hero subheading', () => {
      render(<HomePage />);
      expect(
        screen.getByText(/platform-reported attribution is self-grading homework/i),
      ).toBeInTheDocument();
    });

    it('renders the See how it works CTA as a link to /services', () => {
      render(<HomePage />);
      expect(screen.getByRole('link', { name: /see how it works/i })).toHaveAttribute(
        'href',
        '/services',
      );
    });

    it('fires trackClickCta when a CTA link is clicked', async () => {
      const user = userEvent.setup();
      render(<HomePage />);
      await user.click(screen.getByRole('link', { name: /see how it works/i }));
      expect(mockTrackClickCta).toHaveBeenCalledWith('See how it works', 'hero');
    });
  });

  describe('Problem section', () => {
    it('renders the problem section heading', () => {
      render(<HomePage />);
      expect(screen.getByText(/the measurement gap is getting wider/i)).toBeInTheDocument();
    });

    it('renders the closing statement', () => {
      render(<HomePage />);
      expect(screen.getByText(/that's what I build/i)).toBeInTheDocument();
    });
  });

  describe('What I Deliver section', () => {
    it('renders the section heading', () => {
      render(<HomePage />);
      expect(screen.getByText(/end-to-end measurement infrastructure/i)).toBeInTheDocument();
    });

    it('renders the four tier cards with headings', () => {
      render(<HomePage />);
      expect(screen.getByText('Measurement Foundation')).toBeInTheDocument();
      expect(screen.getByText('Data Infrastructure')).toBeInTheDocument();
      expect(screen.getByText('Business Intelligence')).toBeInTheDocument();
      expect(screen.getByText('Attribution & Advanced Analytics')).toBeInTheDocument();
    });

    it('renders the services CTA link', () => {
      render(<HomePage />);
      expect(
        screen.getByRole('link', { name: /explore the full service offering/i }),
      ).toHaveAttribute('href', '/services');
    });
  });

  describe('Proof section', () => {
    it('renders the proof section heading', () => {
      render(<HomePage />);
      expect(screen.getByText(/this site is the case study/i)).toBeInTheDocument();
    });

    it('renders the under-the-hood call to action text', () => {
      render(<HomePage />);
      expect(screen.getByText(/look under the hood and see for yourself/i)).toBeInTheDocument();
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
      expect(screen.getByText(/see what.*s running underneath/i)).toBeInTheDocument();
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

    it('shows tier previews for each demo', () => {
      render(<HomePage />);
      // Each demo section should indicate which tiers it showcases
      expect(screen.getByText(/tiers 1–4/i)).toBeInTheDocument();
      expect(screen.getByText(/tiers 1, 3 & 4/i)).toBeInTheDocument();
      expect(screen.getByText(/tiers 1, 3 & ai/i)).toBeInTheDocument();
    });
  });
});
