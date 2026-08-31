'use client';

/**
 * Claudish translator — orchestrator for /claudish.
 *
 * Owns input + tab state, runs the detection latch inside the change
 * handler (event-handler setState, no effect-driven detection), wires
 * the translation state machine, rehydrates share links at zero token
 * cost, and fires the page's analytics. Detection fires once per
 * session per language via a sessionStorage gate (nav-hint precedent).
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useClaudishTranslation } from '@/hooks/useClaudishTranslation';
import { useScrollToTopOnMount } from '@/hooks/useScrollToTopOnMount';
import { createDetectionLatch, warmCcld } from '@/lib/claudish/detect';
import { decodeShare } from '@/lib/claudish/share-codec';
import { trackClaudishDetected, trackClaudishShare } from '@/lib/events/track';

import { ClaudishFooter } from './claudish-footer';
import { TranslateSurface } from './translate-surface';

import type { ClaudishDirection } from '@/hooks/useClaudishTranslation';
import type { DetectionLatch } from '@/lib/claudish/detect';
import type { LatchState } from '@/lib/claudish/types';

const ANALYTICS_DIRECTION = {
  en2cl: 'en_to_claudish',
  cl2en: 'claudish_to_en',
} as const;

const NEUTRAL_LATCH: LatchState = {
  detected: false,
  lang: 'unknown',
  confidence: 0.5,
  source: 'heuristic',
};

/** Once-per-session-per-language gate; storage failures fail open (fire once per mount). */
function detectedGateHolds(lang: string): boolean {
  const key = `iap_claudish_detected_${lang}`;
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  } catch {
    return false;
  }
}

export function ClaudishApp({ shareParam }: { shareParam?: string }) {
  useScrollToTopOnMount();
  const share = useMemo(
    () => (shareParam ? decodeShare(shareParam) : null),
    [shareParam]
  );

  const [input, setInput] = useState(share?.source ?? '');
  // 0 = Detect language (auto), 1 = English, 2 = Claudish.
  const [sourceTab, setSourceTab] = useState(
    share ? (share.direction === 'cl2en' ? 2 : 1) : 0
  );
  const [latch, setLatch] = useState<LatchState>(NEUTRAL_LATCH);
  const latchRef = useRef<DetectionLatch | null>(null);
  if (latchRef.current == null) latchRef.current = createDetectionLatch();

  useEffect(() => {
    void warmCcld(); // fire-and-forget: heuristic answers until this lands
  }, []);

  // A share open is a distribution event — exactly once, even under
  // StrictMode's double-invoked effects.
  const shareOpenFiredRef = useRef(false);
  useEffect(() => {
    if (!share || shareOpenFiredRef.current) return;
    shareOpenFiredRef.current = true;
    trackClaudishShare({
      share_action: 'opened_shared_link',
      direction: ANALYTICS_DIRECTION[share.direction],
      output_chars: share.target.length,
      share_truncated: share.excerpt,
      share_url_chars: shareParam?.length ?? 0,
    });
  }, [share, shareParam]);

  const direction: ClaudishDirection =
    sourceTab === 0 ? (latch.detected ? 'cl2en' : 'en2cl') : sourceTab === 2 ? 'cl2en' : 'en2cl';

  const translation = useClaudishTranslation({
    input,
    direction,
    initialResolved: share
      ? { input: share.source, direction: share.direction, text: share.target }
      : undefined,
  });

  const handleInputChange = (value: string) => {
    setInput(value);
    const next = latchRef.current!.update(value);
    setLatch(next);
    if (next.lang !== 'unknown' && !detectedGateHolds(next.lang)) {
      trackClaudishDetected({
        detected_language: next.lang,
        detector_source: next.source,
        input_chars: value.length,
      });
    }
  };

  const handleSwap = () => {
    const output = translation.status === 'done' ? translation.text : '';
    const nextDirection: ClaudishDirection = direction === 'en2cl' ? 'cl2en' : 'en2cl';
    setSourceTab(nextDirection === 'cl2en' ? 2 : 1);
    if (output) {
      setInput(output);
      setLatch(latchRef.current!.update(output));
      translation.translateNow({ input: output, direction: nextDirection });
    }
  };

  // What the Detect tab names. Latched Claudish wins; confident plain
  // English (p < 0.5 at detectable length) gets its own label — Google
  // Translate always names its guess, and a tab that only ever labels
  // Claudish reads as broken when English is pasted. The 0.5-0.8
  // sub-latch gray zone stays at the resting label (honest: not sure).
  const detectedLang: 'en-x-claudish' | 'en' | null =
    sourceTab !== 0 || input.trim().length === 0
      ? null
      : latch.detected
        ? 'en-x-claudish'
        : latch.lang === 'en' && latch.confidence < 0.5
          ? 'en'
          : null;

  // Target row: 0 = English, 1 = Claudish; choosing one determines direction.
  const targetTab = direction === 'en2cl' ? 1 : 0;
  const handleTargetSelect = (index: number) => {
    setSourceTab(index === 0 ? 2 : 1);
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 md:px-6">
      <h1 className="text-xl text-[var(--gt-text,#202124)]">Claudish Translate</h1>
      <TranslateSurface
        sourceProps={{
          value: input,
          onChange: handleInputChange,
          activeTab: sourceTab,
          onTabSelect: setSourceTab,
          detectedLang,
        }}
        targetProps={{
          source: input,
          direction,
          status: translation.status,
          text: translation.text,
          staleText: translation.staleText,
          hasFirstToken: translation.hasFirstToken,
          ttftMs: translation.ttftMs,
          cache: translation.cache,
          activeTab: targetTab,
          onTabSelect: handleTargetSelect,
        }}
        onSwap={handleSwap}
      />
      <ClaudishFooter />
    </main>
  );
}
