'use client';

import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

export function FlipTrigger() {
  const { isOpen, toggle } = useOverlay();

  return (
    <button
      type="button"
      onClick={() => {
        trackClickCta('Under the hood toggle', 'overlay-trigger');
        toggle();
      }}
      aria-label="Look under the hood"
      aria-expanded={isOpen}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-lg transition-all hover:shadow-xl hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 md:bottom-8 md:right-8"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={`text-neutral-700 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
      >
        <rect x="2" y="2" width="16" height="16" rx="2" />
        <path d="M10 2v16" />
        <path d="M6 6l2 2-2 2" opacity={isOpen ? 0.3 : 1} />
        <path d="M14 6l-2 2 2 2" opacity={isOpen ? 1 : 0.3} />
      </svg>
    </button>
  );
}
