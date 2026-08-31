/**
 * @jest-environment jsdom
 *
 * Claudish translator — swap arrows (feat/claudish M2, phase D).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SwapButton } from '@/components/claudish/swap-button';

describe('SwapButton', () => {
  it('invokes onSwap', async () => {
    const user = userEvent.setup();
    const onSwap = jest.fn();
    render(<SwapButton onSwap={onSwap} />);
    await user.click(screen.getByRole('button', { name: /swap languages/i }));
    expect(onSwap).toHaveBeenCalledTimes(1);
  });
});
