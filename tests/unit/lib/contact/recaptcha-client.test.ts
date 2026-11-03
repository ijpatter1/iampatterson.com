/**
 * @jest-environment jsdom
 */

type Win = { grecaptcha?: unknown };

// jsdom never fetches the script, so a load here behaves like one an
// extension holds open: neither onload nor onerror fires.
describe('loadRecaptcha / getRecaptchaToken', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.head.innerHTML = '';
    delete (window as Win).grecaptcha;
  });
  afterEach(() => jest.useRealTimers());

  it('loads the script only when asked, never on import', async () => {
    await import('@/lib/contact/recaptcha-client');
    expect(document.getElementById('recaptcha-enterprise')).toBeNull();
  });

  it('gives up on a stalled script after one deadline, so the form can show its failure message', async () => {
    const { getRecaptchaToken } = await import('@/lib/contact/recaptcha-client');
    const attempt = getRecaptchaToken(10_000);
    jest.advanceTimersByTime(10_000);
    await expect(attempt).rejects.toThrow(/timed out/);
  });

  // Otherwise every retry would wait on the same stalled load, and stalled
  // script elements would pile up with the same id.
  it('removes the stalled script and starts one fresh load on the next attempt', async () => {
    const { getRecaptchaToken } = await import('@/lib/contact/recaptcha-client');
    const first = getRecaptchaToken(10_000);
    jest.advanceTimersByTime(10_000);
    await expect(first).rejects.toThrow();
    expect(document.querySelectorAll('#recaptcha-enterprise')).toHaveLength(0);
    const second = getRecaptchaToken(10_000);
    expect(document.querySelectorAll('#recaptcha-enterprise')).toHaveLength(1);
    jest.advanceTimersByTime(10_000);
    await expect(second).rejects.toThrow();
  });

  // A slow connection can finish loading after an attempt gave up. That copy
  // is used, not loaded a second time.
  it('reuses an API that loaded late instead of loading it again', async () => {
    const { getRecaptchaToken } = await import('@/lib/contact/recaptcha-client');
    (window as Win).grecaptcha = {
      enterprise: {
        ready: (cb: () => void) => cb(),
        execute: () => Promise.resolve('late-token'),
      },
    };
    await expect(getRecaptchaToken(10_000)).resolves.toBe('late-token');
    expect(document.getElementById('recaptcha-enterprise')).toBeNull();
  });
});
