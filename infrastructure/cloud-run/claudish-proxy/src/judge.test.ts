/**
 * Judge ensemble tests.
 *
 * Vendor regeneration: the weights in src/vendor/judge-weights.ts come
 * from ~/.claudish-corpus/models/{r3-conversational,r6h-hn40,
 * r7d-mask-letme04}/ccld-weights.json — regenerate with the node
 * snippet in the session handoff (Decision #24) if those tags change.
 *
 * The drift pin: vendored MODULES must stay byte-identical to their
 * src/lib/claudish originals (repo-relative read; dev/CI only — the
 * Docker image never runs tests).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildNegationFeedback,
  convictingSentences,
  judgeTranslation,
  mechanicalEvidence,
} from './judge';

const LOUD =
  "This isn't just a refactor — it's a robust, seamless transformation, underscoring the fundamental shift in how the pipeline thinks about state.";
const IAN_GOOD = 'You were right to send both fixes, because the first one failed.';
const PLAIN =
  'We looked at three vendors last quarter and picked the one that met the data residency requirement.';

describe('vendored modules drift pin', () => {
  it.each(['text-stats', 'heuristic', 'ccld-featurizer', 'ccld-inference'])(
    '%s.ts is byte-identical to src/lib/claudish',
    (name) => {
      const vendored = readFileSync(path.join(__dirname, 'vendor', `${name}.ts`), 'utf8');
      const original = readFileSync(
        path.join(__dirname, '..', '..', '..', '..', 'src', 'lib', 'claudish', `${name}.ts`),
        'utf8'
      );
      expect(vendored).toBe(original);
    }
  );
});

describe('judgeTranslation', () => {
  it('convicts loud Claudish', () => {
    const v = judgeTranslation(LOUD);
    expect(v.p).toBeGreaterThanOrEqual(0.8);
    expect(v.passed).toBe(false);
  });

  it("passes Ian's reference translation", () => {
    const v = judgeTranslation(IAN_GOOD);
    expect(v.p).toBeLessThan(0.5);
    expect(v.passed).toBe(true);
  });

  it('KNOWN BLIND SPOT, pinned: plain business/technical English convicts on topic', () => {
    // Every content-trained judge convicts technical-topic plain prose
    // (r7d scores flawless technical English at 0.99). The loop handles
    // this via mechanicalEvidence: no actionable evidence -> no retry.
    expect(judgeTranslation(PLAIN).passed).toBe(false);
    expect(
      judgeTranslation(
        'The refactor cut p95 latency from 480ms to 210ms and the error rate from 2.1% to 0.3% (see runbook.md).'
      ).passed
    ).toBe(false);
  });

  it('cannot be cheated by removing surface markers alone (the median holds)', () => {
    // Ian's demonstration text: the LLM's fake "translation" — register
    // skeleton intact, em dashes stripped. All three judges convict it.
    const fake =
      "The five translations r11b still flags are real residual register families. They're translator defects, correctly caught, fixable later on the engine side. The soft-Claudish surrender is not a tuning miss: soft-register Claude prose and de-registered translations overlap at the item level, and no classifier separates overlapping classes.";
    expect(judgeTranslation(fake).passed).toBe(false);
  });
});

describe('mechanicalEvidence (the no-infinite-loops rule)', () => {
  it('plain technical English has nothing actionable: no retry', () => {
    expect(mechanicalEvidence(PLAIN).actionable).toBe(false);
    expect(
      mechanicalEvidence(
        'The refactor cut p95 latency from 480ms to 210ms and the error rate from 2.1% to 0.3% (see runbook.md).'
      ).actionable
    ).toBe(false);
  });

  it('skeleton-Claudish fires the rhythm run: retry is worth buying', () => {
    const fake =
      "The damage was extensive. The mask fixes it. The registry holds. The probes improved. The trade-offs are documented.";
    expect(mechanicalEvidence(fake).actionable).toBe(true);
  });

  it('loud register is actionable through signals', () => {
    expect(mechanicalEvidence(LOUD).actionable).toBe(true);
  });
});

describe('convictingSentences + buildNegationFeedback', () => {
  it('attributes the failing sentences, worst first', () => {
    const mixed = `${IAN_GOOD} ${LOUD}`;
    const worst = convictingSentences(mixed, 2);
    expect(worst.length).toBeGreaterThanOrEqual(1);
    expect(worst[0]).toContain('refactor');
  });

  it('builds specific feedback: kill words, patterns, quoted sentences', () => {
    const v = judgeTranslation(LOUD);
    const fb = buildNegationFeedback(LOUD, v);
    expect(fb).toContain('robust');
    expect(fb).toContain('Detected patterns');
    expect(fb).toContain('Output only the rewritten translation.');
  });
});

describe('missingFacts (arm 2 facts-preservation gate)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { missingFacts, buildFactsFeedback } = require('./judge') as typeof import('./judge');
  it('lists numbers and code-like identifiers present in the input but absent from the output', () => {
    const input = 'Since 2022 the proxy returns 403 for localhost; set ALLOWED_ORIGINS in config.yaml (p95 fell 480ms → 210ms).';
    const output = 'The proxy rejects localhost; set the allowed origins in the config.';
    const missing = missingFacts(input, output);
    expect(missing).toEqual(expect.arrayContaining(['2022', '403', 'ALLOWED_ORIGINS', 'config.yaml', '480ms', '210ms']));
    expect(missingFacts(input, input)).toEqual([]);
  });
  it('ignores plain shouted words that are not identifiers', () => {
    expect(missingFacts('This does NOT scale.', 'This does not scale.')).toEqual([]);
  });
  it('builds a feedback line that names every missing fact', () => {
    const fb = buildFactsFeedback(['2022', '403']);
    expect(fb).toContain('2022');
    expect(fb).toContain('403');
    expect(fb.toLowerCase()).toContain('put');
  });
});
