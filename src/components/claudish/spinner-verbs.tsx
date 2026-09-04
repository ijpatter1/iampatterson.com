'use client';

/**
 * Claudish translator — cycling spinner verbs.
 *
 * The loading state between debounce and first token cycles Claude
 * Code's own spinner verbs — the one place the page winks at its
 * source material. aria-hidden: the target panel's aria-busy is the
 * accessible signal; announcing a verb carousel would be noise.
 * Reduced motion holds the first verb statically.
 */
import { useEffect, useState } from 'react';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { SPINNER_VERB_INTERVAL_MS } from '@/lib/claudish/limits';
import { SPINNER_VERBS } from '@/lib/claudish/spinner-verbs';

export function SpinnerVerbs() {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SPINNER_VERBS.length);
    }, SPINNER_VERB_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  return (
    <span
      aria-hidden="true"
      className="text-sm italic text-[var(--gt-text-3,#80868b)]"
      data-testid="claudish-spinner"
    >
      {SPINNER_VERBS[reducedMotion ? 0 : index]}
    </span>
  );
}
