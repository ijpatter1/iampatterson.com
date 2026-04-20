/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { DemoThemeProvider, useDemoTheme } from '@/components/demo/demo-theme';

function TestConsumer() {
  const theme = useDemoTheme();
  return (
    <div>
      <span data-testid="demo-id">{theme.demoId}</span>
      <span data-testid="accent">{theme.accent}</span>
      <span data-testid="accent-light">{theme.accentLight}</span>
      <span data-testid="accent-dark">{theme.accentDark}</span>
      <span data-testid="label">{theme.label}</span>
    </div>
  );
}

describe('DemoThemeProvider — post-9E ecommerce-only', () => {
  it('provides ecommerce theme for /demo/ecommerce path', () => {
    render(
      <DemoThemeProvider pathname="/demo/ecommerce/cart">
        <TestConsumer />
      </DemoThemeProvider>,
    );
    expect(screen.getByTestId('demo-id')).toHaveTextContent('ecommerce');
    expect(screen.getByTestId('label')).toHaveTextContent('The Tuna Shop');
  });

  it('provides default (null demo) for paths not under /demo/ecommerce', () => {
    // Phase 9E deliverable 7: subscription and leadgen paths are 301-
    // redirected at the Next.js config level. Any request that somehow
    // reaches the DemoThemeProvider on a non-ecommerce path should fall
    // through to the default (null) theme — the provider's shape stays
    // permissive so future demos can be added without rework.
    render(
      <DemoThemeProvider pathname="/demo">
        <TestConsumer />
      </DemoThemeProvider>,
    );
    expect(screen.getByTestId('demo-id')).toHaveTextContent('');
  });

  it('exposes accent color values for the ecommerce theme', () => {
    render(
      <DemoThemeProvider pathname="/demo/ecommerce">
        <TestConsumer />
      </DemoThemeProvider>,
    );
    expect(screen.getByTestId('accent').textContent).toBeTruthy();
    expect(screen.getByTestId('accent-light').textContent).toBeTruthy();
    expect(screen.getByTestId('accent-dark').textContent).toBeTruthy();
  });
});
