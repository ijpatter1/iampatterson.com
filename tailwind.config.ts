import type { Config } from 'tailwindcss';

/**
 * Patterson Consulting Design System
 *
 * Sage green primary, dusty plum secondary, warm neutrals.
 * Cream background (#F5F2EE), editorial serif for headings.
 * See docs/STYLE_GUIDE.md for full specification.
 */

// Raw palette scales
const sage = {
  100: '#E8EFE4',
  200: '#C8D5C0',
  400: '#A8BF9A',
  500: '#8FA680',
  700: '#6B7F5E',
  900: '#4A5640',
};

const plum = {
  100: '#EDE7F1',
  200: '#D0C3D8',
  400: '#A891B0',
  500: '#8B7193',
  700: '#5C4B63',
  900: '#3D2F43',
};

const neutral = {
  100: '#F5F2EE',
  200: '#DDD6CC',
  400: '#B5A899',
  500: '#8C7B6B',
  700: '#5C4A3D',
  900: '#2B2424',
};

const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Override Tailwind's default cool neutral with warm neutrals
        // so existing neutral-* classes throughout the codebase resolve warm
        neutral: {
          50: '#FAF8F5',
          100: neutral[100],
          200: neutral[200],
          300: '#CABFB3',
          400: neutral[400],
          500: neutral[500],
          600: neutral[700],
          700: neutral[700],
          800: neutral[900],
          900: neutral[900],
          950: '#1A1515',
        },

        // Raw palette scales (for explicit use)
        sage,
        plum,
        warm: neutral,

        // Brand — maps to sage
        brand: {
          50: sage[100],
          100: sage[100],
          200: sage[200],
          300: sage[400],
          400: sage[500],
          500: sage[700],
          600: sage[700],
          700: sage[900],
          800: sage[900],
          900: sage[900],
          950: sage[900],
        },

        // Semantic surface tokens
        surface: {
          DEFAULT: neutral[100],
          alt: '#EFEBE5',
          hover: neutral[200],
          dark: sage[900],
          'dark-alt': plum[900],
        },

        // Semantic border tokens
        border: {
          DEFAULT: neutral[200],
          strong: neutral[400],
          muted: '#EFEBE5',
          subtle: neutral[200],
          brand: sage[700],
        },

        // Semantic content tokens
        content: {
          DEFAULT: neutral[900],
          secondary: neutral[700],
          muted: neutral[500],
          disabled: neutral[400],
          inverse: neutral[100],
          'on-dark': neutral[400],
          'on-brand': neutral[100],
        },

        // Accent tokens for status states
        accent: {
          success: '#f0fdf4',
          'success-border': '#bbf7d0',
          'success-text': '#14532d',
          warning: '#fffbeb',
          'warning-border': '#fde68a',
          'warning-text': '#78350f',
          error: '#fef2f2',
          'error-border': '#fecaca',
          'error-text': '#7f1d1d',
        },

        // Demo accent palettes
        demo: {
          // E-commerce (Tuna Shop): amber/terracotta — warm, playful
          ecommerce: {
            DEFAULT: '#C4703A',
            light: '#FDF0E6',
            dark: '#8B4E28',
            muted: '#E8C4A0',
            surface: '#FDF8F3',
          },
          // Subscription (Tuna Box): deep plum — premium, curated
          subscription: {
            DEFAULT: plum[700],
            light: plum[100],
            dark: plum[900],
            muted: plum[200],
            surface: '#F7F3F9',
          },
          // Lead gen (Tuna Partnerships): sage — professional, editorial
          leadgen: {
            DEFAULT: sage[700],
            light: sage[100],
            dark: sage[900],
            muted: sage[200],
            surface: '#F5F8F3',
          },
        },
      },

      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // Display scale for hero/section headings (serif)
        'display-xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
        'display-md': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'display-sm': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.005em' }],
      },

      spacing: {
        section: '6rem',
        'section-sm': '4rem',
      },

      maxWidth: {
        content: '72rem',
        prose: '48rem',
      },

      boxShadow: {
        card: '0 1px 3px 0 rgba(43, 36, 36, 0.06), 0 1px 2px -1px rgba(43, 36, 36, 0.06)',
        elevated: '0 10px 25px -3px rgba(43, 36, 36, 0.08), 0 4px 10px -4px rgba(43, 36, 36, 0.04)',
        glow: '0 0 20px rgba(107, 127, 94, 0.2)',
      },

      borderRadius: {
        card: '0.75rem',
      },

      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'bubble-rise': 'bubble-rise 3s ease-in-out forwards',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(1.5rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bubble-rise': {
          '0%': { opacity: '0', transform: 'translateY(0.5rem) scale(0.95)' },
          '10%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '80%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-0.5rem) scale(0.95)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
