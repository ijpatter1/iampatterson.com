/**
 * CCLD playground: score text from argv or stdin.
 * Usage: npx ts-node -P tsconfig.scripts.json -T scripts/claudish/detect-cli.ts "some text"
 *        echo "text" | npx ts-node -P tsconfig.scripts.json -T scripts/claudish/detect-cli.ts
 */
import { readFileSync } from 'node:fs';

import { loadCcldModel } from '../../src/lib/claudish/ccld';
import { scoreClaudish } from '../../src/lib/claudish/heuristic';
import weights from '../../src/lib/claudish/ccld-weights.json';

const model = loadCcldModel(weights);
const text = process.argv.slice(2).join(' ') || readFileSync(0, 'utf8');
const p = model ? model.predict(text) : NaN;
const h = scoreClaudish(text);
const verdict = p >= 0.8 ? 'Claudish - detected' : p >= 0.5 ? 'claudish-leaning (sub-latch)' : 'English';
console.log(`CCLD  P(claudish) = ${p.toFixed(3)}  →  ${verdict}`);
console.log(`heuristic = ${h.score.toFixed(3)} (${h.activeFamilies} families: ${h.signals.join(', ') || 'none'})`);
