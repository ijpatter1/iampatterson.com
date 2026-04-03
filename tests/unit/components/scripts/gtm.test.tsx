/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

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

describe('GtmScript', () => {
  it('renders consent defaults and GTM script when env var is set', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmScript } = require('@/components/scripts/gtm');
    const { container } = render(<GtmScript />);
    const scripts = container.querySelectorAll('script');
    expect(scripts.length).toBe(2);
  });

  it('sets consent defaults to denied for all categories', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmScript } = require('@/components/scripts/gtm');
    const { container } = render(<GtmScript />);
    const consentScript = container.querySelector('#consent-defaults');
    expect(consentScript).not.toBeNull();
    const content = consentScript?.textContent ?? '';
    expect(content).toContain("'ad_personalization': 'denied'");
    expect(content).toContain("'ad_storage': 'denied'");
    expect(content).toContain("'ad_user_data': 'denied'");
    expect(content).toContain("'analytics_storage': 'denied'");
    expect(content).toContain("'functionality_storage': 'denied'");
    expect(content).toContain("'personalization_storage': 'denied'");
    expect(content).toContain("'security_storage': 'granted'");
    expect(content).toContain('wait_for_update');
    expect(content).toContain("'ads_data_redaction', true");
    expect(content).toContain("'url_passthrough', false");
  });

  it('includes GTM container ID in the script', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmScript } = require('@/components/scripts/gtm');
    const { container } = render(<GtmScript />);
    const gtmScript = container.querySelector('#gtm-script');
    expect(gtmScript?.textContent).toContain('GTM-TEST123');
  });

  it('always loads GTM from Google CDN regardless of sGTM URL', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    process.env.NEXT_PUBLIC_SGTM_URL = 'io.example.com';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmScript } = require('@/components/scripts/gtm');
    const { container } = render(<GtmScript />);
    const gtmScript = container.querySelector('#gtm-script');
    // gtm.js should always come from Google CDN — sGTM handles data
    // transport via server_container_url in the web GTM config tag
    expect(gtmScript?.textContent).toContain('www.googletagmanager.com/gtm.js');
  });

  it('loads GTM from Google CDN when sGTM URL is not set', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    delete process.env.NEXT_PUBLIC_SGTM_URL;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmScript } = require('@/components/scripts/gtm');
    const { container } = render(<GtmScript />);
    const gtmScript = container.querySelector('#gtm-script');
    expect(gtmScript?.textContent).toContain('www.googletagmanager.com/gtm.js');
  });

  it('renders nothing when NEXT_PUBLIC_GTM_ID is not set', () => {
    delete process.env.NEXT_PUBLIC_GTM_ID;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmScript } = require('@/components/scripts/gtm');
    const { container } = render(<GtmScript />);
    expect(container.innerHTML).toBe('');
  });
});

describe('GtmNoscript', () => {
  // noscript children only render server-side — use renderToStaticMarkup
  function renderStatic(element: React.ReactElement): string {
    // Lazy import to avoid top-level TextEncoder issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToStaticMarkup } = require('react-dom/server');
    return renderToStaticMarkup(element);
  }

  it('renders noscript with iframe containing GTM container ID', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmNoscript } = require('@/components/scripts/gtm');
    const html = renderStatic(<GtmNoscript />);
    expect(html).toContain('<noscript>');
    expect(html).toContain('<iframe');
    expect(html).toContain('GTM-TEST123');
  });

  it('always uses Google CDN for noscript iframe', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    process.env.NEXT_PUBLIC_SGTM_URL = 'io.example.com';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmNoscript } = require('@/components/scripts/gtm');
    const html = renderStatic(<GtmNoscript />);
    expect(html).toContain('https://www.googletagmanager.com/ns.html?id=GTM-TEST123');
  });

  it('uses Google CDN for noscript iframe when sGTM URL is not set', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    delete process.env.NEXT_PUBLIC_SGTM_URL;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmNoscript } = require('@/components/scripts/gtm');
    const html = renderStatic(<GtmNoscript />);
    expect(html).toContain('https://www.googletagmanager.com/ns.html?id=GTM-TEST123');
  });

  it('renders nothing when NEXT_PUBLIC_GTM_ID is not set', () => {
    delete process.env.NEXT_PUBLIC_GTM_ID;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmNoscript } = require('@/components/scripts/gtm');
    const html = renderStatic(<GtmNoscript />);
    expect(html).toBe('');
  });
});
