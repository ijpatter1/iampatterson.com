/**
 * @jest-environment node
 *
 * CCLD model card drift pins (feat/claudish M5).
 * The card's headline numbers must match ccld-metrics.json — a retrain
 * that forgets the card fails here (the repo's documented drift classes:
 * doc claims vs artifact truth).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import metrics from '@/lib/claudish/ccld-metrics.json';

const card = readFileSync(
  path.join(process.cwd(), 'docs', 'claudish', 'ccld-model-card.md'),
  'utf8'
);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

describe('model card ↔ metrics drift', () => {
  it('quotes the live test accuracy, precision, recall', () => {
    expect(card).toContain(pct(metrics.test.accuracy));
    expect(card).toContain(pct(metrics.test.precision));
    expect(card).toContain(pct(metrics.test.recall));
  });

  it('quotes the live project-held-out accuracy', () => {
    expect(card).toContain(pct(metrics.projectHeldOut.accuracy));
  });

  it('quotes the confusion matrix cells', () => {
    const { tp, fp, tn, fn } = metrics.test.confusion;
    for (const cell of [tp, fp, tn, fn]) {
      expect(card).toContain(cell.toLocaleString('en-US'));
    }
  });

  it('quotes the calibration temperature', () => {
    expect(card).toContain(`T=${metrics.temperature}`);
  });

  it('names the top-ranked n-gram (the spaced em dash)', () => {
    expect(metrics.topNgrams[0].gram).toBe(' — ');
    expect(card).toContain('spaced em dash');
  });

  it('states the scope limit plainly', () => {
    expect(card).toMatch(/detects ONE person's Claude/);
    expect(card).toMatch(/not a general LLM detector/);
  });
});

describe('committed artifacts honor the scrub invariants', () => {
  const artifacts = ['ccld-fixtures.json', 'ccld-metrics.json'];
  it.each(artifacts)('%s carries no paths, URLs, emails, or secret shapes', (file) => {
    const text = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'claudish', file),
      'utf8'
    );
    expect(text).not.toMatch(/\/Users\/[a-z]/i);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/);
    expect(text).not.toMatch(/AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}/);
  });
});
