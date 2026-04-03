/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PartnershipForm } from '@/components/demo/leadgen/partnership-form';
import { LeadgenLanding } from '@/components/demo/leadgen/leadgen-landing';
import { LeadgenThankYou } from '@/components/demo/leadgen/leadgen-thank-you';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/events/track', () => ({
  trackFormStart: jest.fn(),
  trackFormFieldFocus: jest.fn(),
  trackFormComplete: jest.fn(),
  trackLeadQualify: jest.fn(),
  trackClickCta: jest.fn(),
  trackClickNav: jest.fn(),
}));

import {
  trackFormStart,
  trackFormFieldFocus,
  trackFormComplete,
  trackLeadQualify,
} from '@/lib/events/track';

const mockTrackFormStart = trackFormStart as jest.Mock;
const mockTrackFormFieldFocus = trackFormFieldFocus as jest.Mock;
const mockTrackFormComplete = trackFormComplete as jest.Mock;
const mockTrackLeadQualify = trackLeadQualify as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LeadgenLanding', () => {
  it('renders the page heading', () => {
    render(<LeadgenLanding />);
    expect(screen.getByText(/partner with tuna melts my heart/i)).toBeInTheDocument();
  });

  it('renders partnership highlights', () => {
    render(<LeadgenLanding />);
    expect(screen.getByText(/2\.5M Instagram followers/i)).toBeInTheDocument();
  });

  it('renders partnership types as offering cards', () => {
    render(<LeadgenLanding />);
    expect(screen.getAllByText(/sponsored content/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/product collaboration/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/event sponsorship/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/licensing/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe('PartnershipForm', () => {
  it('renders all required form fields', () => {
    render(<PartnershipForm />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/partnership type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/budget range/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tell us about/i)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<PartnershipForm />);
    expect(screen.getByRole('button', { name: /start the conversation/i })).toBeInTheDocument();
  });

  it('fires trackFormStart on first field focus', async () => {
    const user = userEvent.setup();
    render(<PartnershipForm />);
    await user.click(screen.getByLabelText(/your name/i));
    expect(mockTrackFormStart).toHaveBeenCalledWith('partnership_inquiry');
  });

  it('fires trackFormFieldFocus on field focus', async () => {
    const user = userEvent.setup();
    render(<PartnershipForm />);
    await user.click(screen.getByLabelText(/email/i));
    expect(mockTrackFormFieldFocus).toHaveBeenCalledWith('partnership_inquiry', 'email');
  });

  it('fires trackFormComplete and trackLeadQualify on submit', async () => {
    const user = userEvent.setup();
    render(<PartnershipForm />);
    await user.click(screen.getByRole('button', { name: /start the conversation/i }));
    expect(mockTrackFormComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        form_name: 'partnership_inquiry',
      }),
    );
    expect(mockTrackLeadQualify).toHaveBeenCalledWith(
      expect.objectContaining({
        qualification_tier: expect.any(String),
        partnership_type: expect.any(String),
        budget_range: expect.any(String),
      }),
    );
  });
});

describe('LeadgenThankYou', () => {
  it('renders thank you message', () => {
    render(<LeadgenThankYou />);
    expect(screen.getByText(/thanks for your inquiry/i)).toBeInTheDocument();
  });

  it('mentions under the hood', () => {
    render(<LeadgenThankYou />);
    expect(screen.getByText(/under the hood/i)).toBeInTheDocument();
  });

  it('links back to the landing page', () => {
    render(<LeadgenThankYou />);
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/demo/leadgen');
  });
});
