import { CONTACT_CONFIG } from './config';

interface Grecaptcha {
  enterprise: {
    ready(cb: () => void): void;
    execute(siteKey: string, options: { action: string }): Promise<string>;
  };
}

const SCRIPT_ID = 'recaptcha-enterprise';
let loading: Promise<Grecaptcha> | null = null;

function loaded(): Grecaptcha | null {
  const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
  return g?.enterprise ? g : null;
}

function whenReady(g: Grecaptcha): Promise<Grecaptcha> {
  return new Promise((resolve) => g.enterprise.ready(() => resolve(g)));
}

/**
 * Loads reCAPTCHA Enterprise once, on demand. The contact form calls this when
 * a visitor first focuses a field, so a page view alone makes no request to a
 * reCAPTCHA host. A script that finished loading after an earlier attempt gave
 * up is reused rather than loaded again.
 */
export function loadRecaptcha(): Promise<Grecaptcha> {
  const ready = loaded();
  if (ready) return whenReady(ready);
  if (loading) return loading;
  loading = new Promise<Grecaptcha>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${CONTACT_CONFIG.recaptchaSiteKey}`;
    script.async = true;
    script.onload = () => {
      const g = loaded();
      if (!g) return reject(new Error('recaptcha did not initialise'));
      whenReady(g).then(resolve);
    };
    script.onerror = () => reject(new Error('recaptcha failed to load'));
    document.head.appendChild(script);
  });
  loading.catch(() => abandonLoad());
  return loading;
}

/**
 * Forgets a load that failed or stalled, and removes its script element if the
 * API never arrived, so the next attempt starts one clean load.
 */
function abandonLoad() {
  loading = null;
  if (!loaded()) document.getElementById(SCRIPT_ID)?.remove();
}

/**
 * A token for the contact action, for the server to assess. One deadline,
 * counted from the call, covers loading and token creation together, so a
 * blocked or stalled script ends in the form's failure message instead of a
 * button stuck on "Sending…".
 */
export async function getRecaptchaToken(timeoutMs = 10_000): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abandonLoad();
      reject(new Error('recaptcha timed out'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      loadRecaptcha().then((g) =>
        g.enterprise.execute(CONTACT_CONFIG.recaptchaSiteKey, {
          action: CONTACT_CONFIG.recaptchaAction,
        }),
      ),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
