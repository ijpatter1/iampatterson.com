/**
 * Mine Ian's own USER turns that talk about Claude/AI models — the one
 * clean source of "human typing about Claude" that exists. Targets the
 * human-about-claude FP class (2026-08-31): every other negative source
 * predates Claude, so n-grams like "Claude", "Opus", "reasoning" carry
 * unbounded positive-class odds and any text ABOUT Claude convicts.
 *
 * Human turn = record with type "user" whose message.content is a bare
 * string (assistant/tool records carry structured arrays). Machine
 * artifacts that ride user turns (command output, task notifications,
 * continuation summaries — which are MODEL text) are excluded hard.
 *
 * Output: ~/.claudish-corpus/negatives/claude-topic.txt (one chunk per
 * line, same contract as the other negative sources).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ROOT = path.join(homedir(), '.claude', 'projects');
const OUT = path.join(homedir(), '.claudish-corpus', 'negatives', 'claude-topic.txt');

const TOPIC = /\b(claude|opus|haiku|sonnet|fable|anthropic|gpt-?\d|chatgpt|gemini|llm|model garden|vertex)\b/i;
const ARTIFACT = new RegExp(
  [
    '<local-command-stdout>',
    '<task-notification>',
    '<command-name>',
    '<bash-input>',
    '<bash-stdout>',
    '<system-reminder>',
    '<tool-use',
    '<output-file>',
    'This session is being continued from a previous conversation',
    '<command-message>',
    'Caveat: The messages below',
  ].join('|'),
  'i'
);

function* jsonlFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonlFiles(full);
    else if (entry.name.endsWith('.jsonl')) yield full;
  }
}

function main(): void {
  const chunks: string[] = [];
  const seen = new Set<string>();
  let files = 0;
  for (const file of jsonlFiles(ROOT)) {
    files++;
    let raw: string;
    try {
      if (statSync(file).size > 400 * 1024 * 1024) continue;
      raw = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      if (!line) continue;
      let record: { type?: string; message?: { content?: unknown } };
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record.type !== 'user') continue;
      const content = record.message?.content;
      if (typeof content !== 'string') continue;
      const text = content.trim();
      if (text.length < 30 || text.length > 1200) continue;
      if (ARTIFACT.test(text)) continue;
      if (!TOPIC.test(text)) continue;
      const flat = text.replace(/\s+/g, ' ');
      const key = createHash('sha1').update(flat.toLowerCase()).digest('hex');
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push(flat);
    }
  }
  // Blank-line separated: build-dataset splits sources on \n\n+.
  writeFileSync(OUT, chunks.join('\n\n') + '\n');
  console.log(`${files} files scanned, ${chunks.length} claude-topic human turns → ${OUT}`);
}

main();
