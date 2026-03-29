/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlanCards } from '@/components/demo/subscription/plan-cards';
import { TrialSignupForm } from '@/components/demo/subscription/trial-signup-form';
import { AccountDashboard } from '@/components/demo/subscription/account-dashboard';
import { plans } from '@/lib/demo/plans';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams('plan=good-boy'),
}));

jest.mock('@/lib/events/track', () => ({
  trackPlanSelect: jest.fn(),
  trackTrialSignup: jest.fn(),
  trackClickCta: jest.fn(),
  trackClickNav: jest.fn(),
}));

import { trackPlanSelect, trackTrialSignup } from '@/lib/events/track';

const mockTrackPlanSelect = trackPlanSelect as jest.Mock;
const mockTrackTrialSignup = trackTrialSignup as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PlanCards', () => {
  it('renders all 3 plans', () => {
    render(<PlanCards />);
    for (const p of plans) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
  });

  it('shows prices for each plan', () => {
    render(<PlanCards />);
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByText('$34.99')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
  });

  it('highlights The Good Boy as the most popular', () => {
    render(<PlanCards />);
    const badges = screen.getAllByText(/most popular/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('fires trackPlanSelect when a plan card is clicked', async () => {
    const user = userEvent.setup();
    render(<PlanCards />);
    const buttons = screen.getAllByRole('link', { name: /start.*trial/i });
    await user.click(buttons[0]);
    expect(mockTrackPlanSelect).toHaveBeenCalledWith({
      plan_id: 'pup',
      plan_name: 'The Pup',
      plan_price: 19.99,
    });
  });
});

describe('TrialSignupForm', () => {
  it('renders the signup form with name and email fields', () => {
    render(<TrialSignupForm planId="good-boy" />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows the selected plan name', () => {
    render(<TrialSignupForm planId="good-boy" />);
    expect(screen.getByText(/the good boy/i)).toBeInTheDocument();
  });

  it('renders Start My Trial button', () => {
    render(<TrialSignupForm planId="good-boy" />);
    expect(screen.getByRole('button', { name: /start my trial/i })).toBeInTheDocument();
  });

  it('fires trackTrialSignup on submit', async () => {
    const user = userEvent.setup();
    render(<TrialSignupForm planId="good-boy" />);
    await user.click(screen.getByRole('button', { name: /start my trial/i }));
    expect(mockTrackTrialSignup).toHaveBeenCalledWith({
      plan_id: 'good-boy',
      plan_name: 'The Good Boy',
      plan_price: 34.99,
    });
  });

  it('shows the trial discount', () => {
    render(<TrialSignupForm planId="good-boy" />);
    expect(screen.getByText(/50% off/i)).toBeInTheDocument();
  });
});

describe('AccountDashboard', () => {
  it('shows subscription status as Active Trial', () => {
    render(<AccountDashboard planId="good-boy" />);
    const badges = screen.getAllByText(/active.*trial/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the plan name', () => {
    render(<AccountDashboard planId="good-boy" />);
    expect(screen.getByText(/the good boy/i)).toBeInTheDocument();
  });

  it('shows management buttons', () => {
    render(<AccountDashboard planId="good-boy" />);
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
