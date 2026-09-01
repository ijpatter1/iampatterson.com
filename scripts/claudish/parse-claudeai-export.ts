/**
 * Claude.ai export intake — conversational-Claude positives.
 *
 * The Claude Code corpus is WORK register; claude.ai conversations are
 * where Claude talks like a person — exactly the register CCLD is
 * weakest on. Drop the export (Settings → Privacy → Export data →
 * conversations.json from the emailed archive) at
 * ~/.claudish-corpus/raw-claudeai/ and run:
 *   npx ts-node -P tsconfig.scripts.json -T scripts/claudish/parse-claudeai-export.ts
 *
 * Tolerant of schema drift (chat_messages/messages, sender/role, text/
 * content blocks). Same strip → chunk → scrub pipeline as the transcript
 * miner; grouped by conversation uuid for split safety; output NEVER
 * enters the repo. build-dataset picks up claudeai-chunks.jsonl as an
 * additional positive source automatically when present.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { chunkText, seededRng } from './lib/chunk';
import { Deduper } from './lib/dedup';
import { chunkDropReason, stripStructures } from './lib/scrub';

interface ClaudeAiMessage {
  sender?: string;
  role?: string;
  text?: string;
  content?: Array<{ type?: string; text?: string }> | string;
}

interface ClaudeAiConversation {
  uuid?: string;
  id?: string;
  name?: string;
  chat_messages?: ClaudeAiMessage[];
  messages?: ClaudeAiMessage[];
}

function messageText(message: ClaudeAiMessage): string {
  if (typeof message.text === 'string' && message.text.length > 0) return message.text;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((block) => block && (block.type === 'text' || block.type === undefined))
      .map((block) => block.text ?? '')
      .join('\n');
  }
  return '';
}

function isAssistant(message: ClaudeAiMessage): boolean {
  const who = (message.sender ?? message.role ?? '').toLowerCase();
  return who === 'assistant' || who === 'claude';
}

function main(): void {
  const rawDir = path.join(homedir(), '.claudish-corpus', 'raw-claudeai');
  if (!existsSync(rawDir)) {
    console.log(`[claudeai] nothing at ${rawDir} — export claude.ai data there first`);
    return;
  }
  const files = readdirSync(rawDir).filter((f) => f.endsWith('.json'));
  const rng = seededRng(2026);
  const deduper = new Deduper();
  const chunks: Array<{ text: string; sessionId: string; projectId: string }> = [];
  let conversations = 0;
  let messages = 0;
  let dropped = 0;
  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(path.join(rawDir, file), 'utf8'));
    const list: ClaudeAiConversation[] = Array.isArray(parsed)
      ? (parsed as ClaudeAiConversation[])
      : ((parsed as { conversations?: ClaudeAiConversation[] }).conversations ?? []);
    for (const conversation of list) {
      const id = conversation.uuid ?? conversation.id ?? `conv-${conversations}`;
      const messageList = conversation.chat_messages ?? conversation.messages ?? [];
      let sawText = false;
      for (const message of messageList) {
        if (!isAssistant(message)) continue;
        const text = messageText(message);
        if (!text) continue;
        messages++;
        sawText = true;
        const stripped = stripStructures(text);
        for (const chunk of chunkText(stripped, rng)) {
          const normalized = chunk.normalize('NFC').replace(/\s+/g, ' ').trim();
          if (normalized.length < 20) continue;
          if (chunkDropReason(normalized)) {
            dropped++;
            continue;
          }
          if (!deduper.add(normalized)) continue;
          chunks.push({ text: normalized, sessionId: `claudeai:${id}`, projectId: 'claudeai' });
        }
      }
      if (sawText) conversations++;
    }
  }
  const out = path.join(homedir(), '.claudish-corpus', 'claudeai-chunks.jsonl');
  writeFileSync(out, chunks.map((c) => JSON.stringify(c)).join('\n') + '\n');
  console.log(
    `[claudeai] ${conversations} conversations, ${messages} assistant messages -> ${chunks.length} chunks (${dropped} scrub-dropped): ${out}`
  );
}

main();
