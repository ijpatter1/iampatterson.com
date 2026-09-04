/**
 * CCLD model registry — every trained model is archived, comparable, and
 * promotable. Lives OUTSIDE the repo (~/.claudish-corpus/models/) like
 * all corpus artifacts; the repo carries only the currently-promoted
 * model (weights+metrics+fixtures move together — promoting half a
 * model would break the parity tests by design).
 *
 * Usage:
 *   ts-node model-registry.ts archive <tag> [note]   # snapshot src/lib/claudish model
 *   ts-node model-registry.ts list
 *   ts-node model-registry.ts promote <tag>          # registry -> src/lib/claudish
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const REGISTRY = path.join(homedir(), '.claudish-corpus', 'models');
const LIB = path.join(process.cwd(), 'src', 'lib', 'claudish');
const MODEL_FILES = ['ccld-weights.json', 'ccld-metrics.json', 'ccld-fixtures.json'];

function archive(tag: string, note: string): void {
  const dir = path.join(REGISTRY, tag);
  mkdirSync(dir, { recursive: true });
  // Archive from the trainer's staging area when it exists; fall back to
  // src/ (for snapshotting whatever is currently shipped).
  const staging = path.join(REGISTRY, '_last-train');
  const source = existsSync(path.join(staging, 'ccld-weights.json')) ? staging : LIB;
  for (const file of MODEL_FILES) {
    copyFileSync(path.join(source, file), path.join(dir, file));
  }
  const summaryPath = path.join(homedir(), '.claudish-corpus', 'dataset-summary.json');
  if (existsSync(summaryPath)) {
    copyFileSync(summaryPath, path.join(dir, 'dataset-summary.json'));
  }
  const metrics = JSON.parse(readFileSync(path.join(dir, 'ccld-metrics.json'), 'utf8')) as {
    trainedAt?: string;
    test?: { accuracy?: number };
    projectHeldOut?: { accuracy?: number };
  };
  writeFileSync(
    path.join(dir, 'MODEL.json'),
    JSON.stringify(
      {
        tag,
        note,
        archivedFrom: existsSync(path.join(REGISTRY, '_last-train', 'ccld-weights.json'))
          ? 'registry:_last-train'
          : 'src/lib/claudish',
        trainedAt: metrics.trainedAt,
        testAccuracy: metrics.test?.accuracy,
        heldOutAccuracy: metrics.projectHeldOut?.accuracy,
      },
      null,
      2
    )
  );
  console.log(`[registry] archived ${tag}`);
}

function list(): void {
  if (!existsSync(REGISTRY)) {
    console.log('[registry] empty');
    return;
  }
  for (const tag of readdirSync(REGISTRY).sort()) {
    const metaPath = path.join(REGISTRY, tag, 'MODEL.json');
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
    console.log(
      `${tag.padEnd(24)} test=${Number(meta.testAccuracy ?? 0).toFixed(4)} heldOut=${Number(meta.heldOutAccuracy ?? 0).toFixed(4)}  ${meta.note ?? ''}`
    );
  }
}

function promote(tag: string): void {
  const dir = path.join(REGISTRY, tag);
  for (const file of MODEL_FILES) {
    if (!existsSync(path.join(dir, file))) {
      throw new Error(`registry model ${tag} is incomplete: missing ${file}`);
    }
  }
  for (const file of MODEL_FILES) {
    copyFileSync(path.join(dir, file), path.join(LIB, file));
  }
  console.log(`[registry] promoted ${tag} -> src/lib/claudish`);
  console.log('[registry] now run: python3 scripts/claudish/generate-model-card.py && npm test');
}

const [command, tag, ...noteParts] = process.argv.slice(2);
if (command === 'archive' && tag) archive(tag, noteParts.join(' '));
else if (command === 'list') list();
else if (command === 'promote' && tag) promote(tag);
else console.log('usage: archive <tag> [note] | list | promote <tag>');
