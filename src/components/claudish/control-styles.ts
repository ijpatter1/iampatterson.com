/**
 * Claudish translator — shared control classes (21.3, the approved
 * mockup's sizes).
 *
 * Every control is at least 44px to tap and shows a focus ring for the
 * keyboard, in the skin's own focus colour (--gt-focus-ring swaps with
 * data-skin). Kept here, under src/components, because Tailwind only
 * scans src/app and src/components for class names.
 */

/** Keyboard focus ring, the site's ring-2 convention in the skin's colour. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gt-focus-ring,#1a73e8)]';

/** A round 44px icon button: clear, swap, copy, rate, share. */
export const ICON_BUTTON = `inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--gt-text-2,#5f6368)] hover:bg-[var(--gt-surface-alt,#f8f9fa)] ${FOCUS_RING}`;
