'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { EventToast } from './event-toast';

export type ToastPosition = 'near-cart' | 'near-product' | 'near-form' | 'viewport-top';

export interface Toast {
  event_name: string;
  detail?: string;
  routing?: string[];
  position?: ToastPosition;
  /** ms; default ~2400 */
  duration?: number;
}

export interface ActiveToast extends Toast {
  id: number;
}

const DEFAULT_DURATION_MS = 3200;
const MAX_VISIBLE = 3;

interface ToastContextValue {
  push: (toast: Toast) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Reduced-motion is computed once on mount; we use it as a data attribute on
  // the portal so CSS can branch. Lifetime / dismissal scheduling is unchanged.
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: Toast) => {
      const id = ++idRef.current;
      const next: ActiveToast = { ...toast, id };
      setToasts((prev) => {
        // Newest first; cap at MAX_VISIBLE; dropped toasts also lose their pending timer.
        const combined = [next, ...prev];
        if (combined.length <= MAX_VISIBLE) return combined;
        const dropped = combined.slice(MAX_VISIBLE);
        for (const d of dropped) {
          const handle = timersRef.current.get(d.id);
          if (handle !== undefined) {
            clearTimeout(handle);
            timersRef.current.delete(d.id);
          }
        }
        return combined.slice(0, MAX_VISIBLE);
      });
      const duration = toast.duration ?? DEFAULT_DURATION_MS;
      const handle = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, handle);
    },
    [dismiss],
  );

  const clear = useCallback(() => {
    for (const handle of timersRef.current.values()) {
      clearTimeout(handle);
    }
    timersRef.current.clear();
    setToasts([]);
  }, []);

  // Cancel all in-flight timers on unmount so we don't update state after
  // teardown. Accessing `timersRef.current` at cleanup time is the correct
  // pattern here — `timersRef` holds a stable Map instance whose identity
  // never changes; we mutate it in place. react-hooks/exhaustive-deps flags
  // this as a ref-stale-at-cleanup risk, but that rule is written for refs
  // pointing at DOM nodes whose identity can swap between render and unmount.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timers = timersRef.current;
      for (const handle of timers.values()) {
        clearTimeout(handle);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ push, clear }), [push, clear]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-toast-portal=""
            data-reduced-motion={reducedMotion ? 'true' : 'false'}
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed inset-x-0 top-4 z-toast flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:top-6 md:items-end"
          >
            {toasts.map((t) => (
              <EventToast key={t.id} toast={t} reducedMotion={reducedMotion} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
