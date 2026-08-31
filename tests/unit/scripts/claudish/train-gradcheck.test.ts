/**
 * CCLD trainer — finite-difference gradient check (feat/claudish M5).
 * Hand-written backprop is validated numerically before any real
 * training run trusts it: analytic grads within 1e-4 relative error of
 * central differences on a tiny synthetic set.
 */
import {
  Adam,
  backprop,
  extractFeatures,
  initModel,
  tensorSizes,
} from '../../../../scripts/claudish/lib/train-core';
import { seededRng } from '../../../../scripts/claudish/lib/chunk';

const EXAMPLES: Array<{ text: string; label: 0 | 1 }> = [
  { text: 'This is a plain human sentence about bread.', label: 0 },
  { text: "It isn't just bread — it's a robust, seamless tapestry.", label: 1 },
  { text: 'The meeting moved to Thursday afternoon again.', label: 0 },
  { text: 'Delving into the intricate landscape underscores everything.', label: 1 },
];

function lossOf(model: ReturnType<typeof initModel>): number {
  const grads = tensorSizes().map((s) => new Float64Array(s));
  let total = 0;
  for (const example of EXAMPLES) {
    total += backprop(model, extractFeatures(example.text), example.label, grads);
  }
  return total;
}

describe('backprop gradient check', () => {
  it('matches central finite differences within 1e-4 relative error', () => {
    const model = initModel(seededRng(7));
    const grads = tensorSizes().map((s) => new Float64Array(s));
    for (const example of EXAMPLES) {
      backprop(model, extractFeatures(example.text), example.label, grads);
    }
    // Probe a spread of parameters across every tensor.
    const eps = 1e-5;
    let checked = 0;
    for (let tensor = 0; tensor < model.flat.length; tensor++) {
      const p = model.flat[tensor];
      const stride = Math.max(1, Math.floor(p.length / 5));
      for (let i = 0; i < p.length; i += stride) {
        const analytic = grads[tensor][i];
        const original = p[i];
        p[i] = original + eps;
        const plus = lossOf(model);
        p[i] = original - eps;
        const minus = lossOf(model);
        p[i] = original;
        const numeric = (plus - minus) / (2 * eps);
        const denom = Math.max(1e-6, Math.abs(analytic) + Math.abs(numeric));
        expect(Math.abs(analytic - numeric) / denom).toBeLessThan(1e-4);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('a few Adam steps reduce the loss on the synthetic set', () => {
    const model = initModel(seededRng(11));
    const optimizer = new Adam(tensorSizes(), 0.01);
    const before = lossOf(model);
    for (let step = 0; step < 30; step++) {
      const grads = tensorSizes().map((s) => new Float64Array(s));
      for (const example of EXAMPLES) {
        backprop(model, extractFeatures(example.text), example.label, grads);
      }
      optimizer.step(model.flat, grads, EXAMPLES.length);
    }
    expect(lossOf(model)).toBeLessThan(before * 0.5);
  });
});
