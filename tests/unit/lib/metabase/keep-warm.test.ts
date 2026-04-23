/**
 * @jest-environment node
 *
 * Phase 9F D9 quality-improvement: organic Metabase dashboard keep-warm.
 *
 * The module fires a server-side warmup (embed HTML + metadata + per-card
 * data endpoints) on homepage / demo-entry render, with a 30-min
 * module-scope debounce, so Metabase's card cache + BigQuery's 24h query
 * cache are populated before a visitor reaches /demo/ecommerce/confirmation.
 * Never awaited by callers (fire-and-forget via the `FireAndForget`
 * variant), never rejects.
 */
import {
  DEBOUNCE_MS,
  _resetDebounceForTests,
  warmMetabaseDashboard,
  warmMetabaseDashboardFireAndForget,
} from '@/lib/metabase/keep-warm';

const SAMPLE_URL =
  'https://bi.iampatterson.com/embed/dashboard/SAMPLE.JWT.TOKEN#bordered=true&titled=false';
const SAMPLE_TOKEN = 'SAMPLE.JWT.TOKEN';

// Modern Metabase (v0.47+, the project runs v0.59.6) emits `dashcards`.
// Legacy `ordered_cards` is covered by a dedicated pin below.
const sampleMetadata = {
  dashcards: [
    { id: 10, card: { id: 100 } },
    { id: 11, card: { id: 101 } },
    { id: 12, card: { id: 102 } },
  ],
};

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

function makeFetchMock(): FetchMock {
  return jest.fn(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url.includes('/api/embed/dashboard/') && !url.includes('/dashcard/')) {
      return new Response(JSON.stringify(sampleMetadata), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('ok', { status: 200 });
  });
}

describe('warmMetabaseDashboard', () => {
  beforeEach(() => {
    _resetDebounceForTests();
  });

  it('fires the full warmup sequence when debounce is cold', async () => {
    const fetchFn = makeFetchMock();
    await warmMetabaseDashboard({
      mintUrl: () => SAMPLE_URL,
      fetchFn,
      now: () => 1_000_000,
    });
    const urls = fetchFn.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain(SAMPLE_URL);
    expect(urls).toContain(`https://bi.iampatterson.com/api/embed/dashboard/${SAMPLE_TOKEN}`);
    expect(urls).toContain(
      `https://bi.iampatterson.com/api/embed/dashboard/${SAMPLE_TOKEN}/dashcard/10/card/100`,
    );
    expect(urls).toContain(
      `https://bi.iampatterson.com/api/embed/dashboard/${SAMPLE_TOKEN}/dashcard/11/card/101`,
    );
    expect(urls).toContain(
      `https://bi.iampatterson.com/api/embed/dashboard/${SAMPLE_TOKEN}/dashcard/12/card/102`,
    );
  });

  it('skips the warmup when called a second time within the debounce window', async () => {
    const fetchFn = makeFetchMock();
    const now = jest.fn(() => 1_000_000);
    await warmMetabaseDashboard({ mintUrl: () => SAMPLE_URL, fetchFn, now });
    fetchFn.mockClear();
    now.mockReturnValue(1_000_000 + 10_000);
    await warmMetabaseDashboard({ mintUrl: () => SAMPLE_URL, fetchFn, now });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fires again once the debounce window elapses', async () => {
    const fetchFn = makeFetchMock();
    const now = jest.fn(() => 1_000_000);
    await warmMetabaseDashboard({ mintUrl: () => SAMPLE_URL, fetchFn, now });
    fetchFn.mockClear();
    now.mockReturnValue(1_000_000 + DEBOUNCE_MS + 1);
    await warmMetabaseDashboard({ mintUrl: () => SAMPLE_URL, fetchFn, now });
    expect(fetchFn).toHaveBeenCalled();
  });

  it('is a no-op when mintUrl returns null (env not configured)', async () => {
    const fetchFn = makeFetchMock();
    await warmMetabaseDashboard({
      mintUrl: () => null,
      fetchFn,
      now: () => 1_000_000,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('swallows fetch failures (resolves undefined, never rejects the caller promise)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const fetchFn: FetchMock = jest.fn(async () => {
        throw new Error('network unreachable');
      });
      await expect(
        warmMetabaseDashboard({
          mintUrl: () => SAMPLE_URL,
          fetchFn,
          now: () => 1_000_000,
        }),
      ).resolves.toBeUndefined();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('emits a single console.warn on upstream fetch failure for operator observability', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const fetchFn: FetchMock = jest.fn(async () => {
        throw new Error('network unreachable');
      });
      await warmMetabaseDashboard({
        mintUrl: () => SAMPLE_URL,
        fetchFn,
        now: () => 1_000_000,
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/\[metabase\/keep-warm\]/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('warns when every card fan-out fetch fails (ship-gate canary on a partial-IAP regression)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const fetchFn: FetchMock = jest.fn(async (input) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        // HTML + metadata succeed; the dashcard endpoints (the expensive
        // BQ-populating layer) all reject, exactly the partial-IAP
        // regression pattern this warn exists to surface.
        if (url.includes('/dashcard/')) {
          throw new Error('card endpoint unreachable');
        }
        if (url.includes('/api/embed/dashboard/')) {
          return new Response(JSON.stringify(sampleMetadata), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('ok', { status: 200 });
      });
      await warmMetabaseDashboard({
        mintUrl: () => SAMPLE_URL,
        fetchFn,
        now: () => 1_000_000,
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/all card fan-out fetches failed/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn on card fan-out partial failures (only all-fail is noteworthy)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      let cardCallCount = 0;
      const fetchFn: FetchMock = jest.fn(async (input) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/dashcard/')) {
          cardCallCount += 1;
          if (cardCallCount === 1) throw new Error('one card errored');
          return new Response('ok', { status: 200 });
        }
        if (url.includes('/api/embed/dashboard/')) {
          return new Response(JSON.stringify(sampleMetadata), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('ok', { status: 200 });
      });
      await warmMetabaseDashboard({
        mintUrl: () => SAMPLE_URL,
        fetchFn,
        now: () => 1_000_000,
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn when upstream fetches succeed', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const fetchFn = makeFetchMock();
      await warmMetabaseDashboard({
        mintUrl: () => SAMPLE_URL,
        fetchFn,
        now: () => 1_000_000,
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('falls back to legacy ordered_cards when modern dashcards is absent', async () => {
    const fetchFn: FetchMock = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/api/embed/dashboard/') && !url.includes('/dashcard/')) {
        return new Response(
          JSON.stringify({
            ordered_cards: [
              { id: 20, card: { id: 200 } },
              { id: 21, card: { id: 201 } },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('ok', { status: 200 });
    });
    await warmMetabaseDashboard({
      mintUrl: () => SAMPLE_URL,
      fetchFn,
      now: () => 1_000_000,
    });
    const urls = fetchFn.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain(
      `https://bi.iampatterson.com/api/embed/dashboard/${SAMPLE_TOKEN}/dashcard/20/card/200`,
    );
    expect(urls).toContain(
      `https://bi.iampatterson.com/api/embed/dashboard/${SAMPLE_TOKEN}/dashcard/21/card/201`,
    );
  });

  it('tolerates a malformed metadata response (neither dashcards nor ordered_cards) without blowing up the card fan-out', async () => {
    const fetchFn: FetchMock = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/api/embed/dashboard/') && !url.includes('/dashcard/')) {
        return new Response('"not-a-real-metadata-shape"', { status: 200 });
      }
      return new Response('ok', { status: 200 });
    });
    await expect(
      warmMetabaseDashboard({
        mintUrl: () => SAMPLE_URL,
        fetchFn,
        now: () => 1_000_000,
      }),
    ).resolves.toBeUndefined();
    // HTML + metadata were fetched, but no dashcard calls
    const urls = fetchFn.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('/dashcard/'))).toBe(false);
  });

  it('is a no-op when the mintUrl does not contain a parseable JWT segment', async () => {
    const fetchFn = makeFetchMock();
    await warmMetabaseDashboard({
      mintUrl: () => 'https://bi.iampatterson.com/not-an-embed-path',
      fetchFn,
      now: () => 1_000_000,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('warmMetabaseDashboardFireAndForget', () => {
  beforeEach(() => {
    _resetDebounceForTests();
  });

  it('returns void synchronously (not a Promise) so Server Components cannot accidentally await it', () => {
    const fetchFn = makeFetchMock();
    const result = warmMetabaseDashboardFireAndForget({
      mintUrl: () => SAMPLE_URL,
      fetchFn,
      now: () => 1_000_000,
    });
    expect(result).toBeUndefined();
    expect((result as unknown as Promise<unknown>)?.then).toBeUndefined();
  });

  it('triggers the warmup fetch chain under the hood', async () => {
    const fetchFn = makeFetchMock();
    warmMetabaseDashboardFireAndForget({
      mintUrl: () => SAMPLE_URL,
      fetchFn,
      now: () => 1_000_000,
    });
    // Yield to the microtask queue so the async warmup chain runs
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchFn).toHaveBeenCalled();
  });

  it('does not throw even when the inner warmup rejects', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const fetchFn: FetchMock = jest.fn(async () => {
        throw new Error('network');
      });
      expect(() =>
        warmMetabaseDashboardFireAndForget({
          mintUrl: () => SAMPLE_URL,
          fetchFn,
          now: () => 1_000_000,
        }),
      ).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      warnSpy.mockRestore();
    }
  });
});
