'use client';

import { createContext, useContext } from 'react';

type DemoId = 'ecommerce' | 'subscription' | 'leadgen';

interface DemoTheme {
  demoId: DemoId | null;
  label: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  accentMuted: string;
  accentSurface: string;
  /** Tailwind class for the accent top border */
  borderAccentClass: string;
  /** Tailwind class for text in the accent color */
  textAccentClass: string;
  /** Tailwind class for background in the accent surface */
  bgSurfaceClass: string;
}

const themes: Record<DemoId, Omit<DemoTheme, 'demoId'>> = {
  ecommerce: {
    label: 'The Tuna Shop',
    accent: '#d97706',
    accentLight: '#fef3c7',
    accentDark: '#92400e',
    accentMuted: '#fde68a',
    accentSurface: '#fffbeb',
    borderAccentClass: 'border-demo-ecommerce',
    textAccentClass: 'text-demo-ecommerce-dark',
    bgSurfaceClass: 'bg-demo-ecommerce-surface',
  },
  subscription: {
    label: 'Tuna Subscription',
    accent: '#0d9488',
    accentLight: '#ccfbf1',
    accentDark: '#134e4a',
    accentMuted: '#99f6e4',
    accentSurface: '#f0fdfa',
    borderAccentClass: 'border-demo-subscription',
    textAccentClass: 'text-demo-subscription-dark',
    bgSurfaceClass: 'bg-demo-subscription-surface',
  },
  leadgen: {
    label: 'Tuna Partnerships',
    accent: '#6366f1',
    accentLight: '#e0e7ff',
    accentDark: '#3730a3',
    accentMuted: '#c7d2fe',
    accentSurface: '#eef2ff',
    borderAccentClass: 'border-demo-leadgen',
    textAccentClass: 'text-demo-leadgen-dark',
    bgSurfaceClass: 'bg-demo-leadgen-surface',
  },
};

const defaultTheme: DemoTheme = {
  demoId: null,
  label: '',
  accent: '',
  accentLight: '',
  accentDark: '',
  accentMuted: '',
  accentSurface: '',
  borderAccentClass: '',
  textAccentClass: '',
  bgSurfaceClass: '',
};

const DemoThemeContext = createContext<DemoTheme>(defaultTheme);

function resolveDemoId(pathname: string): DemoId | null {
  if (pathname.startsWith('/demo/ecommerce')) return 'ecommerce';
  if (pathname.startsWith('/demo/subscription')) return 'subscription';
  if (pathname.startsWith('/demo/leadgen')) return 'leadgen';
  return null;
}

interface DemoThemeProviderProps {
  pathname: string;
  children: React.ReactNode;
}

export function DemoThemeProvider({ pathname, children }: DemoThemeProviderProps) {
  const demoId = resolveDemoId(pathname);
  const theme: DemoTheme = demoId ? { demoId, ...themes[demoId] } : defaultTheme;

  return <DemoThemeContext.Provider value={theme}>{children}</DemoThemeContext.Provider>;
}

export function useDemoTheme(): DemoTheme {
  return useContext(DemoThemeContext);
}
