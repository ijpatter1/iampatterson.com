/**
 * improvementEpsilon option (3.5 Flash-Lite re-tune, 2026-09-01).
 *
 * On the 99-input pool, 3.5 Flash-Lite's median per-retry gain (+0.019)
 * sits under the default 0.03 plateau cut, so the loop was stopping
 * retries that were still improving. The default is now 0.015; the
 * option lets a tier or an experiment set it explicitly. The judge is mocked here so the
 * attempt trajectory is exact; the real judge cannot be steered to
 * sub-epsilon steps from fixture text.
 */
import type { GeminiEvent, GeminiTurn } from './gemini';

jest.mock('./judge', () => {
  const actual = jest.requireActual('./judge') as typeof import('./judge');
  return {
    ...actual,
    judgeTranslation: (text: string) => {
      const p = Number(/Score ([0-9]+(?:\.[0-9]+)?)/.exec(text)?.[1] ?? 1);
      return { p, passed: p < 0.5, heuristic: actual.judgeTranslation(text).heuristic };
    },
  };
});

import { runCl2enLoop } from './cl2en-loop';

/** Convicting text with mechanical evidence, so the retry gate opens. */
const draft = (p: number) =>
  `This isn't just a fix — it's a robust, comprehensive testament to design. Score ${p}.`;

function scripted(ps: number[]) {
  const calls: GeminiTurn[][] = [];
  let clock = 0;
  return {
    calls,
    deps: {
      nowMs: () => (clock += 5),
      stream(turns: GeminiTurn[]): AsyncIterable<GeminiEvent> {
        calls.push(turns);
        const p = ps[Math.min(calls.length - 1, ps.length - 1)];
        return (async function* () {
          yield { kind: 'text', text: draft(p) } as GeminiEvent;
          yield {
            kind: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
            finishReason: 'STOP',
          } as GeminiEvent;
        })();
      },
    },
  };
}

const emit = { token: () => undefined, revise: () => undefined };

describe('improvementEpsilon', () => {
  // Trajectory 0.80 -> 0.78 -> 0.76: each gain is 0.02.
  const trajectory = [0.8, 0.78, 0.76];

  it('the old 0.03 cut, passed explicitly, stops after the first sub-epsilon retry', async () => {
    const { deps, calls } = scripted(trajectory);
    const result = await runCl2enLoop('x', 'sys', deps, emit, {
      maxAttempts: 3,
      deadlineMs: 9000,
      improvementEpsilon: 0.03,
    });
    expect(calls).toHaveLength(2);
    expect(result.attempts.map((a) => a.p)).toEqual([0.8, 0.78]);
  });

  it('the default cut (0.015 since the 3.5 Flash-Lite re-tune) keeps buying attempts on 0.02 gains', async () => {
    const { deps, calls } = scripted(trajectory);
    const result = await runCl2enLoop('x', 'sys', deps, emit, { maxAttempts: 3, deadlineMs: 9000 });
    expect(calls).toHaveLength(3);
    expect(result.attempts.map((a) => a.p)).toEqual([0.8, 0.78, 0.76]);
  });
});
