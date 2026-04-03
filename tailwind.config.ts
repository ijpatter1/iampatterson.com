import type { Config } from 'tailwindcss';

/**
 * Patterson Consulting Design System
 *
 * Brand identity: Deep midnight navy (#0f1729) as the anchor color,
 * with a warm amber primary for CTAs and energy. Three demo accent
 * palettes carry through from homepage spotlight to demo pages.
 *
 * Philosophy: Dark, confident, distinctive. Not another gray-on-white
 * consulting template.
 */

const brand = {
  50: '#f0f4ff',
  100: '#dbe4ff',
  200: '#b5c7ff',
  300: '#8aa6ff',
  400: '#5f82ff',
  500: '#3b5bdb',
  600: '#2b44b8',
  700: '#1e3395',
  800: '#142472',
  900: '#0f1729',
  950: '#090e1a',
};

const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — deep midnight navy to light wash
        brand,

        // Semantic surface tokens
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f8f9fc',
          hover: '#f0f2f7',
          dark: brand[900],
          'dark-alt': brand[950],
        },

        // Semantic border tokens
        border: {
          DEFAULT: '#e2e5ed',
          strong: '#c8cdd8',
          muted: '#f0f2f7',
          brand: brand[500],
        },

        // Semantic content tokens
        content: {
          DEFAULT: brand[900],
          secondary: '#3d4663',
          muted: '#6b7394',
          disabled: '#9ca3be',
          inverse: '#ffffff',
          'on-dark': '#c8cdd8',
          'on-brand': '#ffffff',
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

        // Demo accent palettes — each demo has its own color world
        demo: {
          // E-commerce (Tuna Shop): warm amber/terracotta — playful, energetic
          ecommerce: {
            DEFAULT: '#d97706',
            light: '#fef3c7',
            dark: '#92400e',
            muted: '#fde68a',
            surface: '#fffbeb',
          },
          // Subscription (Tuna Box): deep teal/emerald — premium, curated
          subscription: {
            DEFAULT: '#0d9488',
            light: '#ccfbf1',
            dark: '#134e4a',
            muted: '#99f6e4',
            surface: '#f0fdfa',
          },
          // Lead gen (Tuna Partnerships): cool slate/indigo — editorial, polished
          leadgen: {
            DEFAULT: '#6366f1',
            light: '#e0e7ff',
            dark: '#3730a3',
            muted: '#c7d2fe',
            surface: '#eef2ff',
          },
        },
      },

      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // Display scale for hero/section headings
        'display-xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        'display-md': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-sm': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
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
        card: '0 1px 3px 0 rgba(15, 23, 41, 0.06), 0 1px 2px -1px rgba(15, 23, 41, 0.06)',
        elevated: '0 10px 25px -3px rgba(15, 23, 41, 0.08), 0 4px 10px -4px rgba(15, 23, 41, 0.04)',
        glow: '0 0 20px rgba(59, 91, 219, 0.15)',
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
