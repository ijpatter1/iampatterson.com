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
export async function getRecaptchaToken(timeoutMs = 10_000): Promise<string> {
  // A blocked or stalled script must end in the form's failure message, not
  // a button stuck on "Sending…".
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('recaptcha timed out')), timeoutMs);
  });
  try {
    const g = await Promise.race([loadRecaptcha(), timeout]);
    return await Promise.race([
      g.enterprise.execute(CONTACT_CONFIG.recaptchaSiteKey, {
        action: CONTACT_CONFIG.recaptchaAction,
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
