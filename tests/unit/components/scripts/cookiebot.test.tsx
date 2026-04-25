/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

// Mock next/script to render as a testable element
jest.mock('next/script', () => {
  return function MockScript(props: Record<string, unknown>) {
    const { children, dangerouslySetInnerHTML, ...rest } = props;
    if (dangerouslySetInnerHTML) {
      return (
        <script
          {...(rest as React.ScriptHTMLAttributes<HTMLScriptElement>)}
          dangerouslySetInnerHTML={dangerouslySetInnerHTML as { __html: string }}
        />
      );
    }
    return <script {...(rest as React.ScriptHTMLAttributes<HTMLScriptElement>)}>{children}</script>;
  };
});

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('CookiebotScript', () => {
  it('renders Cookiebot script with correct CBID when env var is set', () => {
    process.env.NEXT_PUBLIC_COOKIEBOT_ID = 'test-cbid-123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CookiebotScript } = require('@/components/scripts/cookiebot');
    const { container } = render(<CookiebotScript />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('src')).toBe('https://consent.cookiebot.com/uc.js');
    expect(script?.getAttribute('data-cbid')).toBe('test-cbid-123');
    // Phase 1 D3 architectural amendment (2026-04-25): blockingmode is
    // "manual" so Cookiebot doesn't rewrite <script> tags in <head>;
    // gating delegates to GTM Consent Mode v2 + the explicit gtag bridge
    // in src/lib/events/track.ts. See docs/ARCHITECTURE.md "Cookiebot +
    // GTM Consent Mode".
    expect(script?.getAttribute('data-blockingmode')).toBe('manual');
  });

  it('renders nothing when NEXT_PUBLIC_COOKIEBOT_ID is not set', () => {
    delete process.env.NEXT_PUBLIC_COOKIEBOT_ID;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CookiebotScript } = require('@/components/scripts/cookiebot');
    const { container } = render(<CookiebotScript />);
    expect(container.innerHTML).toBe('');
  });
});
