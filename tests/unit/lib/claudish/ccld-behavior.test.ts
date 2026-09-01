/**
 * CCLD behavioral pins — minimal pairs (feat/claudish, post-gate).
 *
 * Born from a user-caught false positive: "let me" saturates Claude Code
 * transcripts as a workflow opener (24% of positive chunks) while the
 * original negative corpus — formal docs + encyclopedia — contained it
 * 18 times in 6MB, so the model learned the phrase as near-sufficient
 * (P≈0.998) and convicted ordinary speech on it. The fix: conversational
 * pre-2023 negatives (Cornell movie dialogs, 260 natural "let me" hits)
 * + damping the opener's positive share at training. These pairs hold
 * the line: everyday "let me" must NOT flip the side, while real
 * Claudish carrying the same phrase must still convict on its other
 * signals. Every string here is hand-written fixture text.
 */
import { loadCcldModel } from '@/lib/claudish/ccld';
import weights from '@/lib/claudish/ccld-weights.json';

const model = loadCcldModel(weights);
const p = (text: string) => (model as NonNullable<typeof model>).predict(text);

describe('conversational "let me" minimal pairs', () => {
  it('loads the model', () => {
    expect(model).not.toBeNull();
  });

  it.each([
    'Hang on a minute, let me call my wife and make sure this is ok with her.',
    'Let me know if Thursday works for the budget review.',
    'Sure, let me grab my coat and we can head out for lunch.',
  ])('everyday speech stays English despite "let me": %s', (text) => {
    expect(p(text)).toBeLessThan(0.5);
  });

  it('the phrase alone must not swing the verdict across the boundary', () => {
    const withPhrase = 'Hang on a minute, let me call my wife and make sure this is ok with her.';
    const without = 'Hang on a minute while I call my wife and make sure this is ok with her.';
    // Both English, and the gap the phrase contributes stays modest.
    expect(p(withPhrase) - p(without)).toBeLessThan(0.35);
  });

  it('real Claudish keeps convicting even when it opens with the phrase', () => {
    expect(
      p(
        "Let me delve into this — it isn't just a bug; it's a robust, seamless testament to the intricate interplay of state, underscoring the pivotal architecture."
      )
    ).toBeGreaterThan(0.8);
  });
});
