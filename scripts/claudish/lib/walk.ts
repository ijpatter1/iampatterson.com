/**
 * Claudish corpus miner — transcript discovery (shared by mine-corpus
 * and extract-human-turns). Subagent transcripts nest arbitrarily
 * (subagents spawn subagents); every file under a session dir inherits
 * the TOP-LEVEL session uuid — the split-safety unit.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface TranscriptFile {
  file: string;
  projectId: string;
  sessionId: string;
  /** Nested under a session dir (subagent transcript): its final message addresses the parent agent, not Ian. */
  isSubagent: boolean;
}

function collectSessionFiles(
  dir: string,
  projectId: string,
  sessionId: string,
  out: TranscriptFile[]
): void {
  for (const entry of readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stat = statSync(entryPath);
    if (stat.isFile() && entry.endsWith('.jsonl')) {
      out.push({ file: entryPath, projectId, sessionId, isSubagent: true });
    } else if (stat.isDirectory() && entry !== 'tool-results') {
      collectSessionFiles(entryPath, projectId, sessionId, out);
    }
  }
}

export function findTranscripts(root: string): TranscriptFile[] {
  const out: TranscriptFile[] = [];
  for (const project of readdirSync(root)) {
    const projectDir = path.join(root, project);
    if (!statSync(projectDir).isDirectory()) continue;
    for (const entry of readdirSync(projectDir)) {
      const entryPath = path.join(projectDir, entry);
      const stat = statSync(entryPath);
      if (stat.isFile() && entry.endsWith('.jsonl')) {
        out.push({
          file: entryPath,
          projectId: project,
          sessionId: entry.replace(/\.jsonl$/, ''),
          isSubagent: false,
        });
      } else if (stat.isDirectory() && entry !== 'memory') {
        collectSessionFiles(entryPath, project, entry, out);
      }
    }
  }
  return out;
}
