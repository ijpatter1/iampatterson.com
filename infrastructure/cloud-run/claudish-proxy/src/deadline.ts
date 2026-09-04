/**
 * Deadline-bounded iteration for upstream streams (review batch 2, 2026-09-03).
 *
 * The Claude ladder always had a first-token deadline; the Gemini loop had
 * none, so a stream that accepted the request and never emitted a frame
 * held the request until Cloud Run's 60s timeout with no fall-through. Both
 * paths now share this helper: `deadlineMs` null means wait forever.
 */
export class StallDeadline extends Error {
  constructor(message = 'upstream stalled past its deadline') {
    super(message);
    this.name = 'StallDeadline';
  }
}

export async function nextWithDeadline<T>(
  iterator: AsyncIterator<T>,
  deadlineMs: number | null
): Promise<IteratorResult<T>> {
  if (deadlineMs === null) return iterator.next();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new StallDeadline()), deadlineMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
