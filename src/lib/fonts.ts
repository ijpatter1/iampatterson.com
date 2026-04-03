import { Inter, Space_Grotesk } from 'next/font/google';

/**
 * Body font: Inter — clean, highly legible, professional.
 * Excellent for data-heavy content and long-form reading.
 */
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

/**
 * Display font: Space Grotesk — geometric, distinctive, modern.
 * Strong personality without being decorative. Works well for
 * bold hero text and section headings.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});
