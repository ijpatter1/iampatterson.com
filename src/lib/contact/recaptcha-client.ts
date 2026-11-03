import { CONTACT_CONFIG } from './config';

interface Grecaptcha {
  enterprise: {
    ready(cb: () => void): void;
    execute(siteKey: string, options: { action: string }): Promise<string>;
  };
}

let loading: Promise<Grecaptcha> | null = null;

/**
 * Loads reCAPTCHA Enterprise once, on demand. The contact form calls this when
 * a visitor first focuses a field, so a page view alone makes no request to a
 * reCAPTCHA host.
 */
export function loadRecaptcha(timeoutMs = 10_000): Promise<Grecaptcha> {
  if (loading) return loading;
  loading = new Promise<Grecaptcha>((resolve, reject) => {
    // A script held open by an extension fires neither onload nor onerror.
    // The timeout rejects, and the reset below lets the next attempt start
    // a fresh load instead of waiting on the stalled one.
    const timer = setTimeout(() => reject(new Error('recaptcha timed out')), timeoutMs);
    const script = document.createElement('script');
    script.id = 'recaptcha-enterprise';
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${CONTACT_CONFIG.recaptchaSiteKey}`;
    script.async = true;
    script.onload = () => {
      const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
      if (!g?.enterprise) return reject(new Error('recaptcha did not initialise'));
      g.enterprise.ready(() => {
        clearTimeout(timer);
        resolve(g);
      });
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('recaptcha failed to load'));
    };
    document.head.appendChild(script);
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** A token for the contact action, for the server to assess. */
export async function getRecaptchaToken(timeoutMs = 10_000): Promise<string> {
  const g = await loadRecaptcha(timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      g.enterprise.execute(CONTACT_CONFIG.recaptchaSiteKey, {
        action: CONTACT_CONFIG.recaptchaAction,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('recaptcha timed out')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
