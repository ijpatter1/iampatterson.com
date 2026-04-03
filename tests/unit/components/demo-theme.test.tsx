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

describe('DemoThemeProvider', () => {
  it('provides ecommerce theme for /demo/ecommerce path', () => {
    render(
      <DemoThemeProvider pathname="/demo/ecommerce/cart">
        <TestConsumer />
      </DemoThemeProvider>,
    );
    expect(screen.getByTestId('demo-id')).toHaveTextContent('ecommerce');
    expect(screen.getByTestId('label')).toHaveTextContent('The Tuna Shop');
  });

  it('provides subscription theme for /demo/subscription path', () => {
    render(
      <DemoThemeProvider pathname="/demo/subscription">
        <TestConsumer />
      </DemoThemeProvider>,
    );
    expect(screen.getByTestId('demo-id')).toHaveTextContent('subscription');
    expect(screen.getByTestId('label')).toHaveTextContent('Tuna Subscription');
  });

  it('provides leadgen theme for /demo/leadgen path', () => {
    render(
      <DemoThemeProvider pathname="/demo/leadgen/thanks">
        <TestConsumer />
      </DemoThemeProvider>,
    );
    expect(screen.getByTestId('demo-id')).toHaveTextContent('leadgen');
    expect(screen.getByTestId('label')).toHaveTextContent('Tuna Partnerships');
  });

  it('provides default (null demo) for /demo root path', () => {
    render(
      <DemoThemeProvider pathname="/demo">
        <TestConsumer />
      </DemoThemeProvider>,
    );
    expect(screen.getByTestId('demo-id')).toHaveTextContent('');
  });

  it('exposes accent color values', () => {
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
