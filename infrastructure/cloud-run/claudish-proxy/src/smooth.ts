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
