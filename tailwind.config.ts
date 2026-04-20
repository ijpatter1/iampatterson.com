import type { Config } from 'tailwindcss';

/**
 * Patterson Consulting Design System
 *
 * Editorial direction (9A-redesign): paper/ink neutral palette plus a single
 * dynamic accent. Persimmon on the marketing surface, phosphor amber in the
 * under-the-hood overlay. The swap is driven at runtime via the `--accent`
 * CSS variable; use `text-accent-current` / `bg-accent-current` / etc. to
 * consume it.
 *
 * Fonts: Instrument Serif (display), Plus Jakarta Sans (body), JetBrains Mono (mono).
 */

const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens — all white
        surface: {
          DEFAULT: '#ffffff',
          alt: '#fafafa',
          hover: '#f5f5f5',
          dark: '#111111',
          'dark-alt': '#1a1a1a',
        },

        // Semantic border tokens
        border: {
          DEFAULT: '#e5e5e5',
          strong: '#d4d4d4',
          muted: '#f5f5f5',
          subtle: '#e5e5e5',
          brand: '#111111',
        },

        // Semantic content tokens — black and grey
        content: {
          DEFAULT: '#111111',
          secondary: '#525252',
          muted: '#a3a3a3',
          disabled: '#d4d4d4',
          inverse: '#ffffff',
          'on-dark': '#a3a3a3',
          'on-brand': '#ffffff',
        },

        // Brand — placeholder black, will be replaced with accent
        brand: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#525252',
          600: '#404040',
          700: '#262626',
          800: '#1a1a1a',
          900: '#111111',
          950: '#0a0a0a',
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

        // Editorial accent — persimmon on paper, phosphor amber under the hood.
        // `accent-current` is dynamic: reads `--accent`, swapped by OverlayProvider.
        persimmon: '#EA5F2A',
        phosphor: '#FFA400',
        'accent-current': 'var(--accent)',

        // Paper / ink scale aligned with the prototype. Kept alongside the
        // existing surface/content/border tokens so existing components keep
        // working; new editorial surfaces consume these directly.
        paper: {
          DEFAULT: '#FFFFFF',
          alt: '#F5F5F5',
          deep: '#E8E8E8',
        },
        ink: {
          DEFAULT: '#111111',
          2: '#333333',
          3: '#5C5C5C',
          4: '#949494',
        },
        rule: {
          DEFAULT: '#222222',
          soft: 'rgba(17, 17, 17, 0.12)',
          faint: 'rgba(17, 17, 17, 0.06)',
        },

        // Underside (overlay) scale — editorial's negative. Near-black paper,
        // warm cream ink, amber as luminous signal. Used ONLY inside the
        // under-the-hood overlay surface.
        'u-paper': {
          DEFAULT: '#0D0B0A',
          alt: '#141210',
          deep: '#1D1A17',
        },
        'u-ink': {
          DEFAULT: '#F5EFE3',
          2: '#D7CFC0',
          3: '#A39A8A',
          4: '#6E675C',
        },
        'u-rule': {
          DEFAULT: 'rgba(245, 239, 227, 0.18)',
          soft: 'rgba(245, 239, 227, 0.1)',
          faint: 'rgba(245, 239, 227, 0.05)',
        },

        // Demo accent palettes — all neutral for now
        demo: {
          ecommerce: {
            DEFAULT: '#525252',
            light: '#f5f5f5',
            dark: '#262626',
            muted: '#d4d4d4',
            surface: '#ffffff',
          },
          subscription: {
            DEFAULT: '#525252',
            light: '#f5f5f5',
            dark: '#262626',
            muted: '#d4d4d4',
            surface: '#ffffff',
          },
          leadgen: {
            DEFAULT: '#525252',
            light: '#f5f5f5',
            dark: '#262626',
            muted: '#d4d4d4',
            surface: '#ffffff',
          },
        },
      },

      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
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
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        elevated: '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -2px rgba(0, 0, 0, 0.04)',
        glow: '0 0 20px rgba(0, 0, 0, 0.08)',
      },

      borderRadius: {
        card: '0.75rem',
      },

      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'bubble-rise': 'bubble-rise 3s ease-in-out forwards',
        'session-pulse': 'session-pulse 2.4s ease-out infinite',
        // Phase 9E D1 — UX_PIVOT_SPEC §3.1: the pulse is "slightly
        // stronger on desktop than mobile. The mobile eye forgives
        // more motion; desktop visitors stare longer." Desktop
        // variant has larger travel (scale 1 → 2.6) and faster
        // cycle (1.9s) so the affordance has more presence as
        // visitors linger.
        'session-pulse-strong': 'session-pulse-strong 1.9s ease-out infinite',
        'live-strip': 'live-strip 40s linear infinite',
        // Phase 9E D1 first-session nav hint: amber ring expanding outward
        // from the SessionPulse. Slower + larger travel than session-pulse
        // so the hint reads as "notice me" rather than "live signal."
        'nav-hint-ring': 'nav-hint-ring 1.8s ease-out infinite',
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
        'session-pulse': {
          '0%': { opacity: '0.6', transform: 'scale(1)' },
          '80%': { opacity: '0', transform: 'scale(2.2)' },
          '100%': { opacity: '0', transform: 'scale(2.2)' },
        },
        'session-pulse-strong': {
          '0%': { opacity: '0.75', transform: 'scale(1)' },
          '80%': { opacity: '0', transform: 'scale(2.6)' },
          '100%': { opacity: '0', transform: 'scale(2.6)' },
        },
        'live-strip': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'nav-hint-ring': {
          // F5 UAT S11.2 fix: max scale reduced 2.5 → 1.8 so the ring
          // stays within safe bounds when SessionPulse sits top-right on
          // mobile. Pre-fix the ring expanded ~55px past each side of a
          // 44×44 button, clipping past the 360px viewport right edge.
          '0%': { opacity: '0.8', transform: 'scale(1)' },
          '80%': { opacity: '0', transform: 'scale(1.8)' },
          '100%': { opacity: '0', transform: 'scale(1.8)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
