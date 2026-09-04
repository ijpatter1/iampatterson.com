/**
 * claudish-proxy — deterministic em-dash removal for cl2en output.
 *
 * "No em dashes in the output" is cl2en's hardest contract line, and
 * the model honors it statistically, not absolutely (temp-0 copy
 * attractors on identifier-dense input carry input dashes through —
 * observed live 2026-09-01). This smoother makes the contract
 * mechanical: " — " becomes ", ", a bare "—" becomes ",", a
 * stream-initial dash is dropped. Stateful because a spaced dash can
 * straddle SSE frame boundaries: the tail of each chunk that could
 * still become part of a dash sequence (" ", "—", " —") is held back
 * until the next chunk or flush() resolves it.
 */
/** The wrapper tags every user turn puts around the source text. One
 *  spelling, shared by the Claude adapter, the Gemini loop and the stripper. */
export const TEXT_MARKER_OPEN = '<text>';
export const TEXT_MARKER_CLOSE = '</text>';

/** The smoother applied to a whole string at once (cache echo gate). */
export function smoothText(text: string): string {
  const s = new EmDashSmoother();
  return s.feed(text) + s.flush();
}

export class EmDashSmoother {
  private holdback = '';
  private started = false;

  feed(chunk: string): string {
    let text = this.holdback + chunk;
    this.holdback = '';
    // An OPEN bold span must be held whole until its close arrives —
    // paired stripping cannot work frame-locally. Odd count of '**'
    // means the last one is unclosed.
    const marks = text.match(/\*\*/g)?.length ?? 0;
    if (marks % 2 === 1) {
      const at = text.lastIndexOf('**');
      this.holdback = text.slice(at);
      text = text.slice(0, at);
    }
    // Then hold a trailing run that could still grow into " — " or "**".
    const keep = /(?: ?— ?| |\*)$/.exec(text);
    if (keep) {
      this.holdback = keep[0] + this.holdback;
      text = text.slice(0, text.length - keep[0].length);
    }
    return this.transform(text);
  }

  flush(): string {
    const rest = this.transform(this.holdback, true);
    this.holdback = '';
    return rest;
  }

  private transform(text: string, final = false): string {
    if (text.length === 0) return text;
    let out = text.replace(/ — /g, ', ').replace(/ —|— /g, ', ').replace(/—/g, ',');
    // Markdown bold survives nothing else in plain English: strip PAIRED
    // double-asterisk emphasis (single asterisks — footnotes, ratings —
    // pass through). Known accepted edge: a literal ** operator in
    // preserved code prose would lose its asterisks.
    out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
    if (final) out = out.replace(/[ ]+$/g, ' ');
    if (!this.started) {
      out = out.replace(/^,? ?/, (s) => (s.startsWith(',') ? '' : s));
      if (out.length > 0) this.started = true;
    } else if (out.length > 0) {
      this.started = true;
    }
    return out;
  }
}

/**
 * Wrapper-tag strip (experiment arm 2, 2026-09-01). The user turn wraps
 * the source in <text>…</text>; one or two outputs in a hundred echo the
 * tags back. A tag is never part of a translation, so it is removed
 * mechanically, frame-safely: a leading run that could still become
 * "<text>" is held until it resolves, and a trailing run that could
 * still become "</text>" is held until the next chunk or flush().
 */
export class MarkerStripper {
  private lead = '';
  private leadDone = false;
  private tail = '';

  feed(chunk: string): string {
    let text = chunk;
    if (!this.leadDone) {
      this.lead += text;
      const target = TEXT_MARKER_OPEN;
      if (this.lead.length < target.length && target.startsWith(this.lead)) return '';
      text = this.lead.startsWith(target) ? this.lead.slice(target.length).replace(/^[ \t]*\n?/, '') : this.lead;
      this.lead = '';
      this.leadDone = true;
    }
    text = this.tail + text;
    this.tail = '';
    const held = /\s*(?:<|<\/|<\/t|<\/te|<\/tex|<\/text|<\/text>)$/.exec(text);
    if (held && held[0].length > 0) {
      this.tail = held[0];
      text = text.slice(0, held.index);
    }
    return text;
  }

  flush(): string {
    const rest = (this.lead + this.tail).replace(/^<text>[ \t]*\n?/, '').replace(/\s*<\/text>\s*$/, '');
    this.lead = '';
    this.tail = '';
    this.leadDone = true;
    return rest;
  }
}
