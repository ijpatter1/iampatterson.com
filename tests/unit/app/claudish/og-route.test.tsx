/**
 * @jest-environment jsdom
 *
 * Claudish translator — dynamic OG card route (feat/claudish M2, phase E6).
 *
 * ImageResponse is mocked (Satori/WASM doesn't run in Jest); what's
 * under test is OUR logic: valid ?t= renders both panels + the site
 * URL, garbage/oversized/absent t falls back to the generic card, any
 * internal throw still returns a Response (never a 500 to an unfurler),
 * and the card is immutable-cacheable (content-addressed by t).
 */
const captured: Array<{ element: unknown; options: Record<string, unknown> }> = [];

jest.mock('next/og', () => ({
  ImageResponse: class MockImageResponse {
    element: unknown;
    options: Record<string, unknown>;
    headers: Map<string, string>;
    constructor(element: unknown, options: Record<string, unknown> = {}) {
      this.element = element;
      this.options = options;
      captured.push({ element, options });
      this.headers = new Map(
        Object.entries((options.headers as Record<string, string>) ?? {})
      );
    }
  },
}));

import { GET } from '@/app/claudish/og/route';
import { SHARE_URL_MAX } from '@/lib/claudish/limits';
import { encodeShare } from '@/lib/claudish/share-codec';

// The route fetches the Roboto TTF via import.meta.url at request time;
// jsdom's fetch is absent — stub it to fail so the code's font fallback
// path (ImageResponse default font) is what tests exercise.
beforeAll(() => {
  (globalThis as Record<string, unknown>).fetch = jest.fn(async () => {
    throw new Error('no network in jsdom');
  });
});

beforeEach(() => {
  captured.length = 0;
});

const textOf = (node: unknown): string => JSON.stringify(node);

// jsdom has no Request; the route only reads request.url.
const req = (url: string) => ({ url }) as unknown as Request;

const validT = () => {
  const { url } = encodeShare(
    {
      direction: 'en2cl',
      source: 'We ship on Friday.',
      target: "We don't just ship on Friday — we make Friday an architecture.",
    },
    { baseUrl: '/claudish' }
  );
  return new URL(url, 'https://x.test').searchParams.get('t') as string;
};

describe('GET /claudish/og', () => {
  it('renders both panels and the site URL for a valid share param', async () => {
    await GET(req(`https://x.test/claudish/og?t=${encodeURIComponent(validT())}`));
    expect(captured).toHaveLength(1);
    const body = textOf(captured[0].element);
    expect(body).toContain('We ship on Friday.');
    expect(body).toContain('we make Friday an architecture');
    expect(body).toContain('iampatterson.com'); // screenshots must carry the site URL
    expect(body).not.toContain('Google');
  });

  it('serves the generic card when t is missing or garbage', async () => {
    await GET(req('https://x.test/claudish/og'));
    await GET(req('https://x.test/claudish/og?t=!!!not-a-payload!!!'));
    expect(captured).toHaveLength(2);
    for (const call of captured) {
      const body = textOf(call.element);
      expect(body).toContain('Claudish');
      expect(body).toContain('iampatterson.com');
    }
  });

  it('rejects an oversized t before decoding (hostile input never reaches the decompressor)', async () => {
    const huge = 'A'.repeat(SHARE_URL_MAX + 1);
    await GET(req(`https://x.test/claudish/og?t=${huge}`));
    expect(textOf(captured[0].element)).not.toContain('AAAA');
  });

  it('sets the immutable cache header (the card is content-addressed by t)', async () => {
    await GET(req(`https://x.test/claudish/og?t=${encodeURIComponent(validT())}`));
    const headers = captured[0].options.headers as Record<string, string>;
    expect(headers['Cache-Control']).toContain('immutable');
  });
});
