'use client';

import { createContext, useContext } from 'react';

type DemoId = 'ecommerce';

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
