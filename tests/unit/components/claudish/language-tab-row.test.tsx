/**
 * @jest-environment jsdom
 *
 * Claudish translator — language tab rows (feat/claudish M2, phase D).
 * Source row: "Detect language | English | Claudish"; target row:
 * "English | Claudish". Proper role=tablist/tab with aria-selected —
 * the tablist precedent the SEO pass deferred site-wide starts here.
 * Live detection swaps the Detect tab's label to "Claudish - detected".
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LanguageTabRow } from '@/components/claudish/language-tab-row';

describe('LanguageTabRow', () => {
  it('renders the source row tabs with tablist semantics', () => {
    render(<LanguageTabRow side="source" activeIndex={0} onSelect={() => {}} detection={null} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Detect language', 'English', 'Claudish']);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('renders the target row tabs', () => {
    render(<LanguageTabRow side="target" activeIndex={1} onSelect={() => {}} detection={null} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'English',
      'Claudish',
    ]);
  });

  it('shows "Claudish - detected" on the Detect tab while detection is live', () => {
    render(<LanguageTabRow side="source" activeIndex={0} onSelect={() => {}} detection={{ lang: 'en-x-claudish', tier: 'confident' }} />);
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Claudish - detected');
  });

  it('names confident plain English too (GT always names its guess)', () => {
    render(<LanguageTabRow side="source" activeIndex={0} onSelect={() => {}} detection={{ lang: 'en', tier: 'confident' }} />);
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('English - detected');
  });

  it('claims the leaning tiers instead of hedging', () => {
    const { rerender } = render(
      <LanguageTabRow side="source" activeIndex={0} onSelect={() => {}} detection={{ lang: 'en', tier: 'leaning' }} />
    );
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Leaning English');
    rerender(
      <LanguageTabRow side="source" activeIndex={0} onSelect={() => {}} detection={{ lang: 'en-x-claudish', tier: 'leaning' }} />
    );
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Leaning Claudish');
  });

  it('reports tab selection by index', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<LanguageTabRow side="source" activeIndex={0} onSelect={onSelect} detection={null} />);
    await user.click(screen.getByRole('tab', { name: 'Claudish' }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
