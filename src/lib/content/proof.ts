/** Proof section and panel copy. Verbatim from the handoff bundle's copy.md. */
export const PROOF = {
  eyebrow: 'Proof',
  title: 'This site runs the stack it describes.',
  body: 'Every scroll and click in your session meets the consent gate first. No tag fires until you choose. What you allow goes through server-side GTM into BigQuery, and comes back to this panel with the ID the server gave it. What you decline stops at the gate. Only the record of your choice gets through, and the panel shows which is which.',
  cta: 'Open the overlay',
  panel: {
    /** The visitor has not answered the banner. Wins over any rows. */
    notChosen:
      'Nothing has been sent yet. That is the consent gate working. Choose in the banner and watch this fill.',
    /** The visitor has chosen and no event has fired yet. */
    waiting: 'Waiting for your first event. Scroll the page.',
    /** A header note, shown above data-layer rows when the stream is not connected. */
    notConnected: "Showing this browser's events. Live stream not connected.",
    /** A header note, shown above stream rows when the stream has given up since it delivered them. */
    streamDropped: 'Live stream dropped. These are the last events it delivered.',
    sent: 'sent',
    blocked: 'blocked',
    blockedReason: 'consent denied',
    regionLabel: 'Your session, live',
    sessionLabel: 'Session',
    consentLabel: 'Consent',
    eventSingular: 'event',
    eventPlural: 'events',
  },
} as const;

/** The LiveStrip's fixed values and labels. */
export const LIVE_STRIP = {
  stack: 'GTM → sGTM → BigQuery',
  warehouse: 'iampatterson_raw.events_raw',
  eventIdLabel: 'pipeline id',
  eventIdEmpty: '······',
  gpcHonored: 'Global Privacy Control honored',
} as const;
