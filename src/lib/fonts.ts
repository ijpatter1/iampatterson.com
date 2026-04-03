import localFont from 'next/font/local';

/**
 * Display font: Instrument Serif — editorial, warm, confident.
 * Used for hero text, section headings, and anywhere the visitor should slow down and read.
 */
export const instrumentSerif = localFont({
  src: [
    {
      path: '../../public/fonts/instrument-serif-regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/instrument-serif-italic.ttf',
      weight: '400',
      style: 'italic',
    },
  ],
  display: 'swap',
  variable: '--font-display',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

/**
 * Body font: Plus Jakarta Sans — clean geometric sans with warm rounded terminals.
 * Readable at every size, professional without being sterile.
 */
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

/**
 * Mono font: JetBrains Mono — credibility signal for technical contexts.
 * Event names, data layer parameters, pipeline IDs, code snippets, dashboard metrics.
 */
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
