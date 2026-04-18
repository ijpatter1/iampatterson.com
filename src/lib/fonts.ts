import localFont from 'next/font/local';

/**
 * Display font: Instrument Serif.
 * Editorial, oversized; used for mastheads, section headlines, the overlay header.
 */
export const instrumentSerif = localFont({
  src: [
    {
      path: '../../public/fonts/instrument-serif.ttf',
      style: 'normal',
    },
    {
      path: '../../public/fonts/instrument-serif-italic.ttf',
      style: 'italic',
    },
  ],
  display: 'swap',
  variable: '--font-display',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const plusJakarta = localFont({
  src: [
    {
      path: '../../public/fonts/plus-jakarta-sans-var.ttf',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-body',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const jetbrainsMono = localFont({
  src: [
    {
      path: '../../public/fonts/jetbrains-mono-var.ttf',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'monospace'],
});
