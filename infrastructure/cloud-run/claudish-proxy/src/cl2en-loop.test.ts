/**
 * Loop orchestration tests — offline, real judge (deterministic
 * weights), scripted fake streams. The fixtures are chosen for their
 * REAL judge behavior: LOUD convicts with actionable evidence, CLEAN
 * passes, TECH_PLAIN convicts on topic with nothing actionable (the
 * blind spot the no-infinite-loops rules exist for).
 */
import { runCl2enLoop, LOOP_MAX_ATTEMPTS } from './cl2en-loop';

import type { GeminiEvent, GeminiTurn } from './gemini';

const LOUD =
  "This isn't just a refactor — it's a robust, seamless transformation, underscoring the fundamental shift in how the pipeline thinks about state.";
const CLEAN = 'You were right to send both fixes, because the first one failed.';
// The loop stores SMOOTHED text (em dashes already rewritten).
const LOUD_SMOOTHED = LOUD.replace(' \u2014 ', ', ');
const TECH_PLAIN =
  'The refactor cut p95 latency from 480ms to 210ms and the error rate from 2.1% to 0.3% (see runbook.md).';

function scriptedDeps(outputs: string[]): {
  deps: { stream: (turns: GeminiTurn[], attempt: number, temperature: number) => AsyncIterable<GeminiEvent>; nowMs: () => number };
  calls: GeminiTurn[][];
} {
  let clock = 0;
  const calls: GeminiTurn[][] = [];
  return {
    calls,
    deps: {
      nowMs: () => (clock += 5),
      stream(turns) {
        calls.push(JSON.parse(JSON.stringify(turns)) as GeminiTurn[]);
        const text = outputs[Math.min(calls.length - 1, outputs.length - 1)];
        return (async function* () {
          // two chunks to exercise smoothing across frames
          yield { kind: 'text', text: text.slice(0, 10) } as GeminiEvent;
          yield { kind: 'text', text: text.slice(10) } as GeminiEvent;
          yield {
            kind: 'stop',
            usage: { inputTokens: 100, outputTokens: 20, cachedTokens: 0 },
            finishReason: 'STOP',
          } as GeminiEvent;
        })();
      },
    },
  };
}

function collector(): { emit: { token: (t: string) => void; revise: () => void }; events: string[] } {
  const events: string[] = [];
  return {
    events,
    emit: {
      token: (t) => events.push(`T:${t}`),
      revise: () => events.push('REVISE'),
    },
  };
}

describe('runCl2enLoop', () => {
  it('clean first attempt: streams live, no retries, passed', async () => {
    const { deps, calls } = scriptedDeps([CLEAN]);
    const { emit, events } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(result.passed).toBe(true);
    expect(result.revised).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(events.join('')).toBe(`T:${CLEAN.slice(0, 10)}T:${CLEAN.slice(10)}`);
  });

  it('convicted-with-evidence retries as a conversation and revises to the better attempt', async () => {
    const { deps, calls } = scriptedDeps([LOUD, CLEAN]);
    const { emit, events } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(result.servedText).toBe(CLEAN);
    expect(result.servedAttempt).toBe(2);
    expect(result.revised).toBe(true);
    expect(result.passed).toBe(true);
    // Conversation shape: retry carries assistant(prev) + user(feedback).
    expect(calls[1].map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(calls[1][1].text).toBe(LOUD_SMOOTHED);
    expect(calls[1][2].text).toContain('Rewrite it as genuinely plain English');
    expect(events).toContain('REVISE');
    expect(events[events.length - 1]).toBe(`T:${CLEAN}`);
  });

  it('NO-INFINITE-LOOPS: topic-convicted plain tech never retries', async () => {
    const { deps, calls } = scriptedDeps([TECH_PLAIN]);
    const { emit } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(result.passed).toBe(false); // the judge's blind spot, honestly reported
    expect(result.revised).toBe(false);
    expect(calls).toHaveLength(1); // no retry bought
    expect(result.attempts[0].actionable).toBe(false);
  });

  it('plateau stops the loop before the attempt cap', async () => {
    // Same convicted output every time: no improvement -> stop after retry 1.
    const { deps, calls } = scriptedDeps([LOUD, LOUD, LOUD]);
    const { emit } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(calls.length).toBe(2);
    expect(result.revised).toBe(false);
    expect(result.servedAttempt).toBe(1);
  });

  it('a worse retry is discarded silently (no revise frame)', async () => {
    const worse = `${LOUD} It also stands as a comprehensive testament to seamless synergy.`;
    const { deps } = scriptedDeps([LOUD, worse]);
    const { emit, events } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(result.servedText).toBe(LOUD_SMOOTHED);
    expect(events).not.toContain('REVISE');
  });

  it('respects the hard attempt cap', async () => {
    // Improving but never passing, always actionable: cap at 3.
    const a1 = `${LOUD} ${LOUD}`;
    const a2 = LOUD;
    const a3 = "This is a robust and seamless fix — underscoring the shift.";
    const { deps, calls } = scriptedDeps([a1, a2, a3]);
    const { emit } = collector();
    await runCl2enLoop('input', 'sys', deps, emit);
    expect(calls.length).toBeLessThanOrEqual(LOOP_MAX_ATTEMPTS);
  });

  it('maps a SAFETY finish on attempt 1 to refused', async () => {
    const deps = {
      nowMs: () => 0,
      stream: () =>
        (async function* () {
          yield {
            kind: 'stop',
            usage: { inputTokens: 10, outputTokens: 0, cachedTokens: 0 },
            finishReason: 'SAFETY',
          } as GeminiEvent;
        })(),
    };
    const { emit } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(result.refused).toBe(true);
  });

  it('accumulates usage across attempts', async () => {
    const { deps } = scriptedDeps([LOUD, CLEAN]);
    const { emit } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(result.usage.inputTokens).toBe(200);
    expect(result.usage.outputTokens).toBe(40);
  });
});

describe('structural retry tier (Ian honesty test, 2026-09-01)', () => {
  // The regression fixture from the honesty test: Claude copy that is
  // Claudish by SKELETON — zero regex-visible evidence, judge ~0.69 —
  // where the light first-pass edit is not enough and a restructured
  // version provably reaches leaning-English (~0.45).
  const LIGHT_EDIT = `We launched a predicted lifetime value system six weeks ago. It scores each new customer, and that score becomes a dollar value that we send to the ad platforms. The platforms treat that dollar value as fact and bid accordingly, so the number we send directly changes who gets acquired next.
The client complains that the customers acquired since the system went live are producing less gross margin than the ones acquired before it. What follows is the system as built, and the results since launch.`;
  const RESTRUCTURED = `Six weeks ago we launched a system that predicts lifetime value. It scores each new customer, turns the score into a dollar value, and sends that to the ad platforms, which bid on it as if it were fact. So the number we send changes who gets acquired next. The client now says the customers acquired since launch bring in less gross margin than the ones before. Here is how the system works and what has happened since.`;

  it('skeleton-Claudish with zero mechanical evidence now buys a structural retry', async () => {
    const { deps, calls } = scriptedDeps([LIGHT_EDIT, RESTRUCTURED]);
    const { emit, events } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(calls.length).toBe(2); // the structural tier bought the retry
    expect(result.servedAttempt).toBe(2);
    expect(result.revised).toBe(true);
    expect(events).toContain('REVISE');
    // The feedback quoted the convicting sentences for the rewrite.
    expect(calls[1][2].text).toContain('These sentences are the problem');
  });

  it('a multi-sentence pure-topic probe stays bounded: one retry, plateau stop', async () => {
    const { deps, calls } = scriptedDeps([LIGHT_EDIT, LIGHT_EDIT, LIGHT_EDIT]);
    const { emit } = collector();
    const result = await runCl2enLoop('input', 'sys', deps, emit);
    expect(calls.length).toBe(2); // probe + plateau cut, never a third
    expect(result.revised).toBe(false);
    expect(result.servedAttempt).toBe(1);
  });

  it('single-sentence topic convictions still never retry (structural needs two)', async () => {
    const { deps, calls } = scriptedDeps([TECH_PLAIN]);
    const { emit } = collector();
    await runCl2enLoop('input', 'sys', deps, emit);
    expect(calls).toHaveLength(1);
  });
});

describe('loopBudgetFor at post length (Stage 1 bundle)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loopBudgetFor } = require('./cl2en-loop');
  it('gives the longest inputs five attempts and a 40s window', () => {
    expect(loopBudgetFor(2500)).toEqual({ maxAttempts: 8, deadlineMs: 40000 });
    expect(loopBudgetFor(3000)).toEqual({ maxAttempts: 8, deadlineMs: 40000 });
  });
  it('keeps the earlier tiers unchanged', () => {
    expect(loopBudgetFor(300)).toEqual({ maxAttempts: 6, deadlineMs: 9000 });
    expect(loopBudgetFor(600)).toEqual({ maxAttempts: 7, deadlineMs: 16000 });
    expect(loopBudgetFor(1500)).toEqual({ maxAttempts: 8, deadlineMs: 25000 });
  });
});
