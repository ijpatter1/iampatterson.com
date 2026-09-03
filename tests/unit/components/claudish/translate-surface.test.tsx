/**
 * @jest-environment jsdom
 *
 * Claudish translator — two-panel surface. Desktop row: both panels
 * stretch to the taller one (Ian, 2026-09-03: "both boxes expand to the
 * same height, max wins"), each keeps a complete border, the swap sits
 * in the gap between them.
 */
import { render, screen } from '@testing-library/react';

import { TranslateSurface } from '@/components/claudish/translate-surface';

const noop = () => {};

function renderSurface() {
  return render(
    <TranslateSurface
      sourceProps={{ value: 'hello', onChange: noop, activeTab: 0, onTabSelect: noop, detection: null }}
      targetProps={{
        source: 'hello',
        direction: 'en2cl',
        status: 'idle',
        text: '',
        staleText: '',
        hasFirstToken: false,
        ttftMs: null,
        cache: 'miss',
        activeTab: 0,
        onTabSelect: noop,
      }}
      onSwap={noop}
    />
  );
}

describe('TranslateSurface', () => {
  it('stretches both panels to the row height from md up (max wins)', () => {
    renderSurface();
    const grid = screen.getByRole('region', { name: /source text/i }).parentElement as HTMLElement;
    expect(grid.className).toContain('md:grid');
    expect(grid.className).not.toContain('md:items-start');
    expect(grid.className).toContain('md:items-stretch');
  });

  it('gives each panel a complete border with the swap in the gap', () => {
    renderSurface();
    const source = screen.getByRole('region', { name: /source text/i });
    const target = screen.getByRole('region', { name: /translation/i });
    expect(source.className).not.toContain('md:border-r-0');
    expect(target.className).not.toContain('md:rounded-l-none');
    const grid = source.parentElement as HTMLElement;
    expect(grid.className).not.toContain('md:gap-0');
  });

  it('keeps the swap button at the tab row while its column stretches', () => {
    renderSurface();
    const swap = screen.getByRole('button', { name: /swap/i });
    expect((swap.parentElement as HTMLElement).className).toContain('items-start');
  });
});
