/**
 * CCLD playground: score text from argv or stdin.
 * Usage: npx ts-node -P tsconfig.scripts.json -T scripts/claudish/detect-cli.ts "some text"
 *        echo "text" | npx ts-node -P tsconfig.scripts.json -T scripts/claudish/detect-cli.ts
 */
import { readFileSync } from 'node:fs';
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

const model = loadCcldModel(weights);
const text = args.join(' ') || readFileSync(0, 'utf8');
const p = model ? model.predict(text) : NaN;
const h = scoreClaudish(text);
const verdict = p >= 0.8 ? 'Claudish - detected' : p >= 0.5 ? 'Leaning Claudish' : p >= 0.3 ? 'Leaning English' : 'English - detected';
console.log(`CCLD[${modelLabel}]  P(claudish) = ${p.toFixed(3)}  →  ${verdict}`);
console.log(`heuristic = ${h.score.toFixed(3)} (${h.activeFamilies} families: ${h.signals.join(', ') || 'none'})`);
