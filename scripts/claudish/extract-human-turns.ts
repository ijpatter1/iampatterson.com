/**
 * Claudish CCLD — Ian's real typed turns as (capped) negatives.
 *
 * Filter (documented circularity: the last stage uses the heuristic to
 * drop pasted-Claude contamination, i.e. the seed patterns help select
 * their own negatives — capped at 10% of the negative class so it
 * cannot dominate, and disclosed in the model card): type==='user',
 * content is a bare string (tool results arrive as arrays), no
 * <command- wrappers / system reminders / code fences, 30-2000 chars,
 * heuristic score < 0.8.
 */
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

import { scoreClaudish } from '../../src/lib/claudish/heuristic';
import { findTranscripts } from './lib/walk';

async function main(): Promise<void> {
  const root = process.argv[2] ?? path.join(homedir(), '.claude', 'projects');
  const outDir = process.argv[3] ?? path.join(homedir(), '.claudish-corpus', 'negatives');
  mkdirSync(outDir, { recursive: true });
  const turns: string[] = [];
  const seen = new Set<string>();
  for (const transcript of findTranscripts(root)) {
    const rl = readline.createInterface({
      input: createReadStream(transcript.file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.includes('"user"')) continue;
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      const r = record as Record<string, unknown>;
      if (r.type !== 'user' || r.isSidechain === true) continue;
      const content = (r.message as Record<string, unknown> | undefined)?.content;
      if (typeof content !== 'string') continue; // arrays are tool results
      const text = content.trim();
      if (text.length < 30 || text.length > 2000) continue;
      if (text.includes('<command-') || text.includes('<system-reminder') || text.includes('```'))
        continue;
      if (scoreClaudish(text).score >= 0.8) continue; // pasted-Claude contamination
      if (seen.has(text)) continue;
      seen.add(text);
      turns.push(text.replace(/\s+/g, ' '));
    }
  }
  writeFileSync(path.join(outDir, 'human-turns.txt'), turns.join('\n\n') + '\n');
  console.log(`[extract-human-turns] ${turns.length} turns, ${turns.join(' ').length} chars`);
}

void main();
