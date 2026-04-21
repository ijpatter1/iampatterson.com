'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { markPipelineBleedConsumed } from '@/components/home/pipeline-bleed-consumed';

export type OverlayTab = 'overview' | 'timeline' | 'consent';

interface OverlayContextValue {
  isOpen: boolean;
  /** The tab requested by the last `open(tab)` call, or null. Consumed by the overlay host. */
  pendingTab: OverlayTab | null;
  toggle: () => void;
  open: (tab?: OverlayTab) => void;
  close: () => void;
  /** Clear pendingTab once the host has consumed it. */
  consumePendingTab: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

const ACCENT_PAPER = '#EA5F2A';
const ACCENT_UNDERSIDE = '#FFA400';
const ACCENT_SWAP_DELAY_MS = 130;

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<OverlayTab | null>(null);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      // Entering open state counts as "overlay has been seen this
      // session", F6 UAT close-out pipeline-bleed-consumed flag.
      if (!prev) markPipelineBleedConsumed();
      return !prev;
    });
  }, []);
  const open = useCallback((tab?: OverlayTab) => {
    if (tab) setPendingTab(tab);
    setIsOpen(true);
    // F6 UAT close-out: mark the pipeline-section's bleed reveal as
    // consumed. Pipeline bleed is a one-shot priming gesture, once
    // the visitor has opened the overlay, the homepage pipeline can
    // render in its calm editorial baseline on subsequent scroll.
    markPipelineBleedConsumed();
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setPendingTab(null);
  }, []);
  const consumePendingTab = useCallback(() => setPendingTab(null), []);

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
    <OverlayContext.Provider value={{ isOpen, pendingTab, toggle, open, close, consumePendingTab }}>
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
