/**
 * claudish-proxy — Gemini streaming client for the cl2en loop.
 *
 * Auth is ambient: the Cloud Run runtime service account's access token
 * from the metadata server (roles/aiplatform.user already granted — no
 * keys, no WIF, and Gemini rides dynamic shared quota, not the
 * stuck-at-zero anthropic bucket). Dev seam: GEMINI_ACCESS_TOKEN env
 * short-circuits the metadata fetch (an access token for the runtime SA,
 * via impersonation, mirrors production identity).
 *
 * Endpoint: Gemini 3.x models are served only through the global endpoint
 * on Vertex; a regional request 404s. GEMINI_LOCATION=global selects it.
 *
 * Transport: streamGenerateContent?alt=sse — data-only SSE frames, each
 * a JSON chunk with candidates[].content.parts[].text deltas and, on
 * the tail chunk, usageMetadata. One pre-stream retry tier for 429/5xx
 * (dynamic shared quota throws transient 429s — observed on the bench).
 */

import { appendFileSync } from 'node:fs';

export interface GeminiTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface GeminiUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export type GeminiEvent =
  | { kind: 'text'; text: string }
  | { kind: 'stop'; usage: GeminiUsage; finishReason: string | null };

export interface GeminiConfig {
  projectId: string;
  location: string;
  modelId: string;
  temperature: number;
  thinkingBudget: number;
  maxOutputTokens: number;
}

const TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

let cachedToken: { token: string; expiresAtMs: number } | null = null;

export async function geminiAccessToken(
  fetchFn: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
  nowMs: number = Date.now(),
): Promise<string> {
  if (env.GEMINI_ACCESS_TOKEN) return env.GEMINI_ACCESS_TOKEN;
  if (cachedToken && nowMs < cachedToken.expiresAtMs) return cachedToken.token;
  const res = await fetchFn(TOKEN_URL, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!res.ok) throw new Error(`metadata token fetch failed: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('metadata token response missing access_token');
  cachedToken = {
    token: body.access_token,
    expiresAtMs: nowMs + Math.max(0, (body.expires_in ?? 300) - 60) * 1000,
  };
  return cachedToken.token;
}

/** Test seam. */
export function resetGeminiTokenCache(): void {
  cachedToken = null;
}

const RETRYABLE = new Set([429, 500, 503, 529]);
const RETRY_DELAYS_MS = [400, 1200];

export async function* streamGemini(
  config: GeminiConfig,
  system: string,
  turns: GeminiTurn[],
  signal: AbortSignal,
  fetchFn: typeof fetch = fetch,
  delayFn: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): AsyncIterable<GeminiEvent> {
  const host =
    config.location === 'global'
      ? 'aiplatform.googleapis.com'
      : `${config.location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.modelId}:streamGenerateContent?alt=sse`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: t.text }],
    })),
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      thinkingConfig: { thinkingBudget: config.thinkingBudget },
    },
  });

  // GEMINI_DEBUG_LOG=<file> (operator seam, off by default): append the exact request body and
  // every raw SSE frame as received. Never set in production; it writes prompt and output text.
  const debugLog = process.env.GEMINI_DEBUG_LOG;
  const debug = (line: string): void => {
    if (debugLog) appendFileSync(debugLog, line + '\n');
  };
  debug(JSON.stringify({ request: { url, body: JSON.parse(body) } }));

  let res: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    const token = await geminiAccessToken(fetchFn);
    res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
      signal,
    });
    if (res.ok) break;
    // Status only in errors — bodies are unowned upstream content.
    if (attempt < RETRY_DELAYS_MS.length && RETRYABLE.has(res.status)) {
      await delayFn(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`gemini upstream HTTP ${res.status}`);
  }
  if (!res.body) throw new Error('gemini upstream returned no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: GeminiUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  let finishReason: string | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Vertex emits CRLF-delimited SSE frames; normalize so the
      // splitter sees plain LF (the live-API gap the fakes reproduced).
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let i;
      while ((i = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        debug(JSON.stringify({ frame }));
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let chunk: {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
              finishReason?: string;
            }>;
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              cachedContentTokenCount?: number;
            };
          };
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue; // tolerate drift
          }
          const candidate = chunk.candidates?.[0];
          const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
          if (text.length > 0) yield { kind: 'text', text };
          if (candidate?.finishReason) finishReason = candidate.finishReason;
          if (chunk.usageMetadata) {
            usage = {
              inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
              outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
              cachedTokens: chunk.usageMetadata.cachedContentTokenCount ?? 0,
            };
          }
        }
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  yield { kind: 'stop', usage, finishReason };
}
