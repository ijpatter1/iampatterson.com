/**
 * CCLD playground: score text from argv or stdin.
 * Usage: npx ts-node -P tsconfig.scripts.json -T scripts/claudish/detect-cli.ts "some text"
 *        echo "text" | npx ts-node -P tsconfig.scripts.json -T scripts/claudish/detect-cli.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { loadCcldModel } from '../../src/lib/claudish/ccld';
import { scoreClaudish } from '../../src/lib/claudish/heuristic';
import shippedWeights from '../../src/lib/claudish/ccld-weights.json';

// --model <registry-tag> probes any archived model instead of the
// shipped one (e.g. --model r6d-claudeai-damped) — for comparing
// candidates before a promotion decision.
const args = process.argv.slice(2);
const modelFlag = args.indexOf('--model');
let weights: unknown = shippedWeights;
let modelLabel = 'shipped';
if (modelFlag >= 0) {
  modelLabel = args[modelFlag + 1];
  weights = JSON.parse(
    readFileSync(
      path.join(homedir(), '.claudish-corpus', 'models', modelLabel, 'ccld-weights.json'),
      'utf8'
    )
  );
  args.splice(modelFlag, 2);
}

// --all: score the input across EVERY registry model side by side,
// plus the heuristic and the product ensemble verdict per model.
const allFlag = args.indexOf('--all');
const compareAll = allFlag >= 0;
if (compareAll) args.splice(allFlag, 1);

const model = loadCcldModel(weights);
const text = args.join(' ') || readFileSync(0, 'utf8');
const tierOf = (p: number) =>
  p >= 0.8 ? 'Claudish - detected' : p >= 0.5 ? 'Leaning Claudish' : p >= 0.3 ? 'Leaning English' : 'English - detected';
const h = scoreClaudish(text);

if (compareAll) {
  const registry = path.join(homedir(), '.claudish-corpus', 'models');
  console.log(`heuristic = ${h.score.toFixed(3)} (${h.activeFamilies} families: ${h.signals.join(', ') || 'none'})`);
  console.log('model                        ccld    product  UI label (product = max(ccld, heuristic))');
  for (const tag of readdirSync(registry).sort()) {
    const wPath = path.join(registry, tag, 'ccld-weights.json');
    if (!existsSync(wPath)) continue;
    const m = loadCcldModel(JSON.parse(readFileSync(wPath, 'utf8')));
    if (!m) continue;
    const ccldP = m.predict(text);
    const product = Math.max(ccldP, h.score);
    const shipped = tag === 'r3-conversational' ? '  ← shipped' : '';
    console.log(`${tag.padEnd(28)} ${ccldP.toFixed(3)}   ${product.toFixed(3)}    ${tierOf(product)}${shipped}`);
  }
} else {
  const p = model ? model.predict(text) : NaN;
  console.log(`CCLD[${modelLabel}]  P(claudish) = ${p.toFixed(3)}  →  ${tierOf(p)}`);
  console.log(`heuristic = ${h.score.toFixed(3)} (${h.activeFamilies} families: ${h.signals.join(', ') || 'none'})`);
}
