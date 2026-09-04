/**
 * claudish-proxy — latency harness (feat/claudish, proxy T14).
 *
 * LIVE suite gated on LATENCY_TEST=1. Measures TTFT (request send to
 * FIRST TOKEN frame, explicitly not the meta frame) over N distinct
 * real inputs per direction — distinct inputs, not cache-busting
 * suffixes, so the numbers reflect real first-request latency.
 * Targets from the spec: p50 < 1000ms, p95 < 2000ms; full render p95
 * < 3000ms for inputs under 300 chars. ~$0.10/run.
 *
 * Against CLAUDISH_PROXY_URL when set (the deployed service, the
 * number that matters) or an in-process server with real lanes.
 * Honest framing: no CI runs this today (no workflow runs Jest; WIF
 * pending) — it is a pre-deploy operator gate via
 * scripts/run-claudish-latency.sh, with baselines committed to
 * docs/perf/.
 */
import { buildDepsFromEnv, createApp } from './server';

import type { Server } from 'node:http';

const LATENCY_ENABLED = process.env.LATENCY_TEST === '1';
const describeIfLatency = LATENCY_ENABLED ? describe : describe.skip;

const N = 20;

const EN_INPUTS = [
  'We fixed the login bug this morning.',
  'Sales were flat this quarter. We need a new plan.',
  'The deploy finished. Watch the error rates.',
  'Can you review my draft before the standup?',
  'The vendor missed the deadline again.',
  'Our churn doubled after the price change.',
  'I am starting a new role on Monday.',
  'The migration took longer than we estimated.',
  'Bring the budget numbers to the review.',
  'The test suite is green and the build is clean.',
  'Marketing wants three new landing pages by Friday.',
  'The onboarding flow confuses new users.',
  'We should sunset the legacy dashboard.',
  'The contract renewal is due next month.',
  'Support tickets spiked after the release.',
  'The API rate limit is too low for our batch jobs.',
  'Hiring is paused until the next quarter.',
  'The demo went well. They asked about pricing.',
  'Our backup restore took four hours.',
  'The redesign shipped without the dark mode.',
] as const;

const CL_INPUTS = [
  "This isn't just a fix — it's a robust foundation for reliability.",
  'The results underscore a pivotal shift in our comprehensive strategy.',
  "You're absolutely right — and this insight serves as a testament to alignment.",
  'Delving into the data reveals an intricate tapestry of user intent.',
  "The launch wasn't merely successful; it was a seamless, holistic triumph.",
  'Each metric showcases the meticulous interplay of design and engineering.',
  'This landscape demands leaders who foster groundbreaking innovation.',
  'The refactor leverages elegant abstractions, ensuring lasting maintainability.',
  "Great question — the answer isn't simple; it's profoundly contextual.",
  'Our roadmap represents a vibrant, crucial evolution of the platform.',
  "The outage wasn't a failure — it was a signal, highlighting resilience gaps.",
  'This proposal bolsters our position, garnering meaningful stakeholder trust.',
  'The audit underscores the importance of comprehensive, robust controls.',
  "It's worth noting the deployment marks a pivotal milestone — one of many.",
  'The team delved deep, crafting a seamless experience across every surface.',
  "This isn't about speed; it's about the intricate balance of quality and pace.",
  'The findings showcase a profound interplay between pricing and retention.',
  'Crucially, the new schema fosters clarity, ensuring every event lands cleanly.',
  'The design stands as a testament to meticulous, holistic thinking.',
  "We didn't just ship a feature — we established a groundbreaking foundation.",
] as const;

interface Sample {
  ttftMs: number;
  totalMs: number;
  chars: number;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function measure(base: string, text: string, direction: string): Promise<Sample> {
  const t0 = Date.now();
  let ttftMs = -1;
  const res = await fetch(`${base}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://iampatterson.com' },
    body: JSON.stringify({ text, direction }),
  });
  if (res.status !== 200 || !res.body) {
    throw new Error(`latency probe got HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (ttftMs < 0 && buffer.includes('"type":"token"')) {
      ttftMs = Date.now() - t0;
    }
  }
  return { ttftMs, totalMs: Date.now() - t0, chars: text.length };
}

describeIfLatency('latency (live API)', () => {
  jest.setTimeout(300000);

  let base: string;
  let server: Server | null = null;

  beforeAll(async () => {
    if (process.env.CLAUDISH_PROXY_URL) {
      base = process.env.CLAUDISH_PROXY_URL.replace(/\/$/, '');
      return;
    }
    const app = createApp(buildDepsFromEnv(process.env));
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server!.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server!.close(resolve));
  });

  it(`p50 TTFT < 1000ms, p95 < 2000ms over ${N} distinct inputs per direction`, async () => {
    const samples: Sample[] = [];
    for (let i = 0; i < N; i++) {
      samples.push(await measure(base, EN_INPUTS[i % EN_INPUTS.length], 'en2cl'));
      samples.push(await measure(base, CL_INPUTS[i % CL_INPUTS.length], 'cl2en'));
    }
    const ttfts = samples.map((s) => s.ttftMs);
    const p50 = percentile(ttfts, 50);
    const p95 = percentile(ttfts, 95);
    const shortTotals = samples.filter((s) => s.chars < 300).map((s) => s.totalMs);
    const renderP95 = percentile(shortTotals, 95);
    console.log(
      `[latency] n=${samples.length} ttft p50=${p50}ms p95=${p95}ms | full-render p95 (<300 chars)=${renderP95}ms`
    );
    expect(p50).toBeLessThan(1000);
    expect(p95).toBeLessThan(2000);
    expect(renderP95).toBeLessThan(3000);
  });
});
