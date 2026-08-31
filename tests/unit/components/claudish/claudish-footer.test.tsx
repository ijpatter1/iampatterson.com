/**
 * @jest-environment jsdom
 *
 * Claudish translator — footer (feat/claudish M2, phase D).
 * Both lines spec-verbatim; the disclaimer is the page's ONLY sanctioned
 * "Google" (enforced globally by the trade-dress guard test in phase F).
 */
import { render, screen } from '@testing-library/react';

import { ClaudishFooter } from '@/components/claudish/claudish-footer';

describe('ClaudishFooter', () => {
  it('renders the attribution line verbatim with a home link', () => {
    render(<ClaudishFooter />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(
      'A toy by Ian Patterson · marketing measurement and agentic AI · iampatterson.com'
    );
    expect(screen.getByRole('link', { name: 'iampatterson.com' })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('renders the disclaimer verbatim', () => {
    render(<ClaudishFooter />);
    expect(screen.getByText('Not affiliated with Google. Yet.')).toBeInTheDocument();
  });
});
