import type { BaseEvent } from './schema';

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

/** Push a typed event onto the GTM data layer. */
export function pushEvent(event: BaseEvent & Record<string, unknown>): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}
