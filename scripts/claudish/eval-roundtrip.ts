/**
 * Round-trip evaluator (2026-09-01).
 *
 * Scores every row of ~/.claudish-corpus/roundtrip-testset.jsonl under
 * one or more registry models (or the shipped weights) and reports the
 * three numbers that define "survives scrutiny":
 *
 *   originals   — % of Claudish originals still >= 0.80 (recall bar:
 *                 the detector must keep convicting my actual prose)
 *   translated  — % of cl2en outputs < 0.50 (Ian's bar: at minimum
 *                 "leaning English"), plus mean and % >= 0.80 (latched
 *                 FPs, the worst case)
 *   humans      — % of human/generic controls < 0.50
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json -T scripts/claudish/eval-roundtrip.ts [tag ...]
 *   (no args: shipped weights; tag 'shipped' also allowed)
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { loadCcldModel } from '../../src/lib/claudish/ccld';

const CORPUS = path.join(homedir(), '.claudish-corpus');
const SET = path.join(CORPUS, 'roundtrip-testset.jsonl');
const SHIPPED = path.join(__dirname, '..', '..', 'src', 'lib', 'claudish', 'ccld-weights.json');

interface Row {
  kind: 'claudish-original' | 'translated-english' | 'human-control';
  id: string;
  text: string;
}

function weightsFor(tag: string): unknown {
  const file = tag === 'shipped' ? SHIPPED : path.join(CORPUS, 'models', tag, 'ccld-weights.json');
  if (!existsSync(file)) throw new Error(`no weights for ${tag} at ${file}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

function main(): void {
  const rows: Row[] = readFileSync(SET, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);
  const tags = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['shipped'];

  for (const tag of tags) {
    const model = loadCcldModel(weightsFor(tag));
    if (!model) {
      console.log(`${tag}: REFUSED by loader (configHash not blessed?)`);
      continue;
    }
    const by: Record<string, number[]> = {};
    for (const row of rows) {
      (by[row.kind] ??= []).push(model.predict(row.text));
    }
    const orig = by['claudish-original'] ?? [];
    const trans = by['translated-english'] ?? [];
    const human = by['human-control'] ?? [];
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    console.log(`\n═══ ${tag}`);
    console.log(
      `originals  (n=${orig.length}): ${pct(orig.filter((p) => p >= 0.8).length, orig.length)} still detected (>=0.80), mean ${mean(orig).toFixed(3)}`,
    );
    console.log(
      `translated (n=${trans.length}): ${pct(trans.filter((p) => p < 0.5).length, trans.length)} leaning-English (<0.50), ${pct(trans.filter((p) => p >= 0.8).length, trans.length)} latched (>=0.80), mean ${mean(trans).toFixed(3)}`,
    );
    console.log(
      `humans     (n=${human.length}): ${pct(human.filter((p) => p < 0.5).length, human.length)} below 0.50, mean ${mean(human).toFixed(3)}`,
    );
    const worstTrans = rows
      .filter((r) => r.kind === 'translated-english')
      .map((r) => ({ id: r.id, p: model.predict(r.text) }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 3);
    console.log(
      `worst translated: ${worstTrans.map((w) => `${w.id}=${w.p.toFixed(3)}`).join('  ')}`,
    );
  }
}

main();
