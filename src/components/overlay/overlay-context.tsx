'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface OverlayContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

const ACCENT_PAPER = '#EA5F2A';
const ACCENT_UNDERSIDE = '#FFA400';
const ACCENT_SWAP_DELAY_MS = 130;

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Accent flips orange→amber mid-boot when the overlay opens, and back to
  // orange immediately on close. Under prefers-reduced-motion, the swap is
  // instant on both edges.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    if (isOpen) {
      if (reduced) {
        root.style.setProperty('--accent', ACCENT_UNDERSIDE);
        return;
      }
      const id = window.setTimeout(() => {
        root.style.setProperty('--accent', ACCENT_UNDERSIDE);
      }, ACCENT_SWAP_DELAY_MS);
      return () => window.clearTimeout(id);
    }

    root.style.setProperty('--accent', ACCENT_PAPER);
  }, [isOpen]);

  return (
    <OverlayContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
}
