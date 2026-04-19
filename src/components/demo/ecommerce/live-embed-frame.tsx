'use client';

import { useState } from 'react';

interface LiveEmbedFrameProps {
  src: string;
  title: string;
}

/**
 * Thin client wrapper around a Metabase static-embed iframe that makes the
 * loading-state UI actually visible. The iframe paints opaque from the
 * moment it mounts, so a purely-CSS placeholder behind it never shows
 * during the Metabase fetch. We render the iframe at opacity: 0 until the
 * `load` event fires, at which point the placeholder underneath is
 * smoothly covered by the real content.
 */
export function LiveEmbedFrame({ src, title }: LiveEmbedFrameProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative overflow-hidden rounded border border-neutral-200 bg-neutral-50">
      <div
        aria-hidden={loaded}
        className={`pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[11px] uppercase tracking-widest text-neutral-400 transition-opacity duration-500 ${
          loaded ? 'opacity-0' : 'opacity-100'
        }`}
        data-testid="live-embed-placeholder"
      >
        Querying BigQuery…
      </div>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer"
        aria-hidden={!loaded}
        tabIndex={loaded ? 0 : -1}
        onLoad={() => setLoaded(true)}
        className={`relative h-[420px] w-full transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ border: 0 }}
      />
    </div>
  );
}
