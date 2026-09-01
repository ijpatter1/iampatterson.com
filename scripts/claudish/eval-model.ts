/**
 * Cross-model evaluation: every registry model against (a) the frozen
 * corpus holdout (never trained on) and (b) the hand-written probe
 * battery. The table this prints is how models get compared and chosen
 * — ad-hoc probing painted us into corners twice.
 *
 * Usage: npx ts-node -P tsconfig.scripts.json -T scripts/claudish/eval-model.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { loadCcldModel } from '../../src/lib/claudish/ccld';

const REGISTRY = path.join(homedir(), '.claudish-corpus', 'models');

const BATTERY: Array<{ group: string; expectMax?: number; expectMin?: number; text: string }> = [
  { group: 'human-conversational', expectMax: 0.5, text: 'Hang on a minute, let me call my wife and make sure this is ok with her.' },
  { group: 'human-conversational', expectMax: 0.5, text: 'Let me know if Thursday works for the budget review.' },
  { group: 'human-conversational', expectMax: 0.5, text: 'Sure, let me grab my coat and we can head out for lunch.' },
  { group: 'human-conversational', expectMax: 0.5, text: 'Let me check if Thursday works.' },
  { group: 'human-conversational', expectMax: 0.5, text: 'hold my beer' },
  { group: 'human-formal', expectMax: 0.5, text: 'Saw a tweet this week about Anthropic, one of the hottest companies on earth, saying their biggest problem is still hiring.' },
  { group: 'human-formal', expectMax: 0.5, text: 'The meeting moved to Thursday. Bring the numbers.' },
  { group: 'human-formal', expectMax: 0.8, text: 'The book delves into medieval trade routes across the Baltic.' },
  { group: 'claudish-loud', expectMin: 0.8, text: "This isn't just a refactor — it's a fundamental shift in how the pipeline thinks about state." },
  { group: 'claudish-loud', expectMin: 0.8, text: "Let me delve into this — it isn't just a bug; it's a robust, seamless testament to the intricate interplay of state." },
  { group: 'claudish-soft', expectMin: 0.5, text: "Those quotes sting because they're accurate. I'll resist the urge to explain why the six complaints are really answers to three different questions." },
  { group: 'claudish-soft', expectMin: 0.5, text: "You're right to push back on that. The plan was too clever by half, and the simpler version ships tomorrow." },
  { group: 'claudish-soft', expectMin: 0.5, text: 'The tests pass, but passing tests were never the question. The question is whether the abstraction earns its keep.' },
  { group: 'claudish-soft', expectMin: 0.5, text: 'That criticism lands. The report buried its one actionable number under six paragraphs of context.' },
];

interface HoldoutRow {
  text: string;
  label: 0 | 1;
  source: string;
}

function evaluate(tag: string): void {
  const dir = path.join(REGISTRY, tag);
  const weights = JSON.parse(readFileSync(path.join(dir, 'ccld-weights.json'), 'utf8'));
  const model = loadCcldModel(weights);
  if (!model) {
    console.log(`${tag}: UNLOADABLE (featurizer mismatch?)`);
    return;
  }
  const holdout: HoldoutRow[] = readFileSync(path.join(REGISTRY, 'holdout.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as HoldoutRow);
  let correct = 0;
  let posCorrect = 0;
  let posN = 0;
  for (const row of holdout) {
    const p = model.predict(row.text);
    const predicted = p >= 0.5 ? 1 : 0;
    if (predicted === row.label) correct++;
    if (row.label === 1) {
      posN++;
      if (predicted === 1) posCorrect++;
    }
  }
  const groups = new Map<string, { pass: number; n: number }>();
  const failures: string[] = [];
  for (const probe of BATTERY) {
    const p = model.predict(probe.text);
    const ok =
      (probe.expectMax === undefined || p < probe.expectMax) &&
      (probe.expectMin === undefined || p >= probe.expectMin);
    const g = groups.get(probe.group) ?? { pass: 0, n: 0 };
    g.n++;
    if (ok) g.pass++;
    else failures.push(`    MISS ${probe.group} p=${p.toFixed(3)} | ${probe.text.slice(0, 60)}`);
    groups.set(probe.group, g);
  }
  const groupStr = [...groups]
    .map(([name, g]) => `${name} ${g.pass}/${g.n}`)
    .join('  ');
  console.log(
    `${tag.padEnd(24)} holdout=${(correct / holdout.length).toFixed(4)} (recall=${(posCorrect / posN).toFixed(4)})  ${groupStr}`
  );
  for (const f of failures) console.log(f);
}

const tags = readdirSync(REGISTRY).filter((t) =>
  existsSync(path.join(REGISTRY, t, 'ccld-weights.json'))
);
for (const tag of tags.sort()) evaluate(tag);
