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
export function loadRecaptcha(): Promise<Grecaptcha> {
  if (loading) return loading;
  loading = new Promise<Grecaptcha>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'recaptcha-enterprise';
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${CONTACT_CONFIG.recaptchaSiteKey}`;
    script.async = true;
    script.onload = () => {
      const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
      if (!g?.enterprise) return reject(new Error('recaptcha did not initialise'));
      g.enterprise.ready(() => resolve(g));
    };
    script.onerror = () => reject(new Error('recaptcha failed to load'));
    document.head.appendChild(script);
  });
  // A failed load can be retried on the next attempt.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** A token for the contact action, for the server to assess. */
export async function getRecaptchaToken(): Promise<string> {
  const g = await loadRecaptcha();
  return g.enterprise.execute(CONTACT_CONFIG.recaptchaSiteKey, {
    action: CONTACT_CONFIG.recaptchaAction,
  });
}
