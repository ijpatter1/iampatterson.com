/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ContactPage from '@/app/contact/page';

// Mock the track module
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock('@/lib/events/track', () => ({
  trackFormStart: jest.fn(),
  trackFormFieldFocus: jest.fn(),
  trackFormSubmit: jest.fn(),
}));

import { trackFormStart, trackFormFieldFocus, trackFormSubmit } from '@/lib/events/track';

const mockTrackFormStart = trackFormStart as jest.Mock;
const mockTrackFormFieldFocus = trackFormFieldFocus as jest.Mock;
const mockTrackFormSubmit = trackFormSubmit as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockClear();
});

describe('ContactPage', () => {
  it('renders the page heading', () => {
    render(<ContactPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /let's talk about your measurement stack/i,
    );
  });

  it('renders the introductory copy', () => {
    render(<ContactPage />);
    expect(screen.getByText(/e-commerce brands, saas companies/i)).toBeInTheDocument();
  });

  it('renders the email address', () => {
    render(<ContactPage />);
    const emailLink = screen.getByRole('link', { name: /ian@iampatterson\.com/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
  });

  it('renders the response expectation', () => {
    render(<ContactPage />);
    expect(screen.getByText(/respond within 24 hours/i)).toBeInTheDocument();
  });

  it('renders a contact form with name, email, and message fields', () => {
    render(<ContactPage />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<ContactPage />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('fires form_start on first field focus', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByLabelText(/name/i));
    expect(mockTrackFormStart).toHaveBeenCalledWith('contact');
    expect(mockTrackFormStart).toHaveBeenCalledTimes(1);
  });

  it('fires form_field_focus on each field focus', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByLabelText(/name/i));
    await user.click(screen.getByLabelText(/email/i));
    expect(mockTrackFormFieldFocus).toHaveBeenCalledWith('contact', 'name');
    expect(mockTrackFormFieldFocus).toHaveBeenCalledWith('contact', 'email');
    expect(mockTrackFormFieldFocus).toHaveBeenCalledTimes(2);
  });

  it('fires form_start only once across multiple field focuses', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByLabelText(/name/i));
    await user.click(screen.getByLabelText(/email/i));
    await user.click(screen.getByLabelText(/message/i));
    expect(mockTrackFormStart).toHaveBeenCalledTimes(1);
  });

  it('fires form_submit and redirects to /contact/thanks on submission', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/message/i), 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact', true);
    expect(mockPush).toHaveBeenCalledWith('/contact/thanks');
  });
});
