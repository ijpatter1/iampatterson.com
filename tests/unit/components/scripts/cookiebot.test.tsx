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

  // Phase 15, deliverable 15.5. Cookiebot's loader writes Consent Mode itself
  // unless told not to: it pushes its own consent update from the raw banner
  // choice. With that on there are two writers, and the site's bridge, which
  // is where Global Privacy Control is honored, is only one of them. The
  // attribute makes the bridge in track.ts the single writer.
  it("turns off Cookiebot's own Consent Mode writes so the site bridge is the only writer", () => {
    process.env.NEXT_PUBLIC_COOKIEBOT_ID = 'test-cbid-123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CookiebotScript } = require('@/components/scripts/cookiebot');
    const { container } = render(<CookiebotScript />);
    expect(container.querySelector('script')?.getAttribute('data-consentmode')).toBe('disabled');
  });

  // The loader signals the raw banner choice in two more ways that
  // data-consentmode does not cover: a Microsoft consent update, and plain
  // data-layer events named cookie_consent_marketing, _statistics and
  // _preferences. A visitor sending Global Privacy Control who accepts in the
  // banner would get cookie_consent_marketing in the GTM data layer. Neither
  // has a consumer here, so both are turned away at the tag.
  it("turns off the loader's Microsoft consent signal", () => {
    process.env.NEXT_PUBLIC_COOKIEBOT_ID = 'test-cbid-123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CookiebotScript } = require('@/components/scripts/cookiebot');
    const { container } = render(<CookiebotScript />);
    expect(container.querySelector('script')?.getAttribute('data-ms-consent-mode')).toBe(
      'disabled',
    );
  });

  it("keeps the loader's own events out of the data layer GTM reads", () => {
    process.env.NEXT_PUBLIC_COOKIEBOT_ID = 'test-cbid-123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CookiebotScript } = require('@/components/scripts/cookiebot');
    const { container } = render(<CookiebotScript />);
    const name = container.querySelector('script')?.getAttribute('data-layer-name');
    expect(name).toBeTruthy();
    expect(name).not.toBe('dataLayer');
  });

  it('has no GTM trigger, tag or variable that reads a Cookiebot data-layer event', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path');
    for (const file of ['web-container.json', 'server-container.json']) {
      const spec = readFileSync(join(process.cwd(), 'infrastructure/gtm', file), 'utf8');
      expect(spec).not.toMatch(/cookie_consent_/);
    }
  });

  it('renders nothing when NEXT_PUBLIC_COOKIEBOT_ID is not set', () => {
    delete process.env.NEXT_PUBLIC_COOKIEBOT_ID;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CookiebotScript } = require('@/components/scripts/cookiebot');
    const { container } = render(<CookiebotScript />);
    expect(container.innerHTML).toBe('');
  });
});
