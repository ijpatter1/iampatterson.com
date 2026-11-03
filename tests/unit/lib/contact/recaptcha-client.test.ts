/**
 * @jest-environment jsdom
 */

// jsdom never fetches the script, so a load here behaves like one an
// extension holds open: neither onload nor onerror fires.
describe('loadRecaptcha / getRecaptchaToken', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.head.innerHTML = '';
  });
  afterEach(() => jest.useRealTimers());

  it('gives up on a stalled script, so the form can show its failure message', async () => {
    const { getRecaptchaToken } = await import('@/lib/contact/recaptcha-client');
    const attempt = getRecaptchaToken(10_000);
    jest.advanceTimersByTime(10_000);
    await expect(attempt).rejects.toThrow(/timed out/);
  });

  // Without the reset, every retry would wait on the same stalled load until
  // the page was reloaded.
  it('starts a fresh load on the next attempt after a timeout', async () => {
    const { loadRecaptcha } = await import('@/lib/contact/recaptcha-client');
    const first = loadRecaptcha(10_000);
    jest.advanceTimersByTime(10_000);
    await expect(first).rejects.toThrow();
    const second = loadRecaptcha(10_000);
    expect(second).not.toBe(first);
    expect(document.querySelectorAll('#recaptcha-enterprise')).toHaveLength(2);
    jest.advanceTimersByTime(10_000);
    await expect(second).rejects.toThrow();
  });

  it('loads the script only when asked, never on import', async () => {
    await import('@/lib/contact/recaptcha-client');
    expect(document.querySelector('#recaptcha-enterprise')).toBeNull();
  });
});
