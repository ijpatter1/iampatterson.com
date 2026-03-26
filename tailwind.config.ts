import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Semantic design tokens — use these over raw neutral-* values
        surface: {
          DEFAULT: colors.white,
          alt: colors.neutral[50],
          hover: colors.neutral[100],
          dark: colors.neutral[900],
        },
        border: {
          DEFAULT: colors.neutral[200],
          strong: colors.neutral[300],
          muted: colors.neutral[100],
        },
        content: {
          DEFAULT: colors.neutral[900],
          secondary: colors.neutral[700],
          muted: colors.neutral[500],
          disabled: colors.neutral[400],
          inverse: colors.white,
          'on-dark': colors.neutral[300],
        },
        accent: {
          success: colors.green[50],
          'success-border': colors.green[200],
          'success-text': colors.green[900],
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
