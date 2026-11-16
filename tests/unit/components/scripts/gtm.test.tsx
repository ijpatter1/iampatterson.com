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
    // gtm.js should always come from Google CDN, sGTM handles data
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

// 15.8: GTM evaluates its page-load triggers against the consent in force
// when it reaches the `gtm.js` event. A returning visitor's stored choice
// has to be in the data layer before that event, or every page-load tag is
// judged against the denied defaults. These run the two rendered scripts in
// the order the page does: the defaults (beforeInteractive) and then the
// loader (afterInteractive).
describe("GtmScript, a returning visitor's stored consent", () => {
  const GRANT =
    '{stamp:%27test%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:1}';
  const DECLINE =
    '{stamp:%27test%27%2Cnecessary:true%2Cpreferences:false%2Cstatistics:false%2Cmarketing:false%2Cmethod:%27explicit%27%2Cver:1}';

  type Entry = Record<string | number, unknown>;
  function runPageScripts(): Entry[] {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GtmScript } = require('@/components/scripts/gtm');
    const { container } = render(<GtmScript />);
    const defaults = container.querySelector('#consent-defaults')?.textContent ?? '';
    const loader = container.querySelector('#gtm-script')?.textContent ?? '';
    // Indirect eval runs each as a classic script at global scope, as the
    // browser does, so `function gtag` becomes window.gtag.
    (0, eval)(defaults);
    (0, eval)(loader);
    return window.dataLayer as Entry[];
  }
  const isConsent = (e: Entry, action: string) => e[0] === 'consent' && e[1] === action;
  const gtmJsIndex = (dl: Entry[]) => dl.findIndex((e) => e.event === 'gtm.js');

  beforeEach(() => {
    window.dataLayer = [];
    document.cookie = 'CookieConsent=; Max-Age=0; Path=/';
  });
  afterEach(() => {
    document.cookie = 'CookieConsent=; Max-Age=0; Path=/';
    delete (window as unknown as { gtag?: unknown }).gtag;
    delete (navigator as unknown as { globalPrivacyControl?: unknown }).globalPrivacyControl;
  });

  it('puts a stored grant in the data layer after the defaults and ahead of gtm.js', () => {
    document.cookie = `CookieConsent=${GRANT}; Path=/`;
    const dl = runPageScripts();
    const defaultAt = dl.findIndex((e) => isConsent(e, 'default'));
    const updateAt = dl.findIndex((e) => isConsent(e, 'update'));
    expect(defaultAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(defaultAt);
    expect(updateAt).toBeLessThan(gtmJsIndex(dl));
    expect(dl[updateAt][2]).toEqual(
      expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'granted' }),
    );
  });

  it('applies Global Privacy Control to the stored choice before GTM sees it', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    document.cookie = `CookieConsent=${GRANT}; Path=/`;
    const dl = runPageScripts();
    const update = dl.find((e) => isConsent(e, 'update'))!;
    expect(update[2]).toEqual(
      expect.objectContaining({
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      }),
    );
  });

  it('sends a stored decline ahead of gtm.js too', () => {
    document.cookie = `CookieConsent=${DECLINE}; Path=/`;
    const dl = runPageScripts();
    const updateAt = dl.findIndex((e) => isConsent(e, 'update'));
    expect(updateAt).toBeGreaterThan(-1);
    expect(updateAt).toBeLessThan(gtmJsIndex(dl));
    expect(dl[updateAt][2]).toEqual(expect.objectContaining({ analytics_storage: 'denied' }));
  });

  it('leaves a visitor who has never chosen on the denied defaults', () => {
    const dl = runPageScripts();
    expect(dl.some((e) => isConsent(e, 'update'))).toBe(false);
    expect(gtmJsIndex(dl)).toBeGreaterThan(-1);
  });
});

describe('GtmNoscript', () => {
  // noscript children only render server-side, use renderToStaticMarkup
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
