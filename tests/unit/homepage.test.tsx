import { render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the hero heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your marketing data is lying to you.',
    );
  });
});
