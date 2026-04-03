import localFont from 'next/font/local';

/**
 * Body font: Inter — clean, highly legible, professional.
 * Uses system font stack as fallback; Inter will be loaded from
 * Google Fonts CDN at runtime via the optimized Next.js font loading.
 *
 * In production (Vercel), next/font/google downloads at build time.
 * For local/sandbox builds without internet, we use a local font
 * definition with system font fallbacks.
 */
export const inter = localFont({
  src: [
    {
      path: '../../public/fonts/inter-var.woff2',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/**
 * Display font: Space Grotesk — geometric, distinctive, modern.
 * Strong personality without being decorative.
 */
export const spaceGrotesk = localFont({
  src: [
    {
      path: '../../public/fonts/space-grotesk-var.woff2',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-display',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});
