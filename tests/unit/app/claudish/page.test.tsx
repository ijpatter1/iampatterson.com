/**
 * @jest-environment jsdom
 *
 * Claudish translator — route page (feat/claudish M2, phase E3).
 * generateMetadata: a valid ?t= yields a dynamic OG card URL; garbage or
 * absence falls back to the layout's static metadata (empty object). The
 * page passes the raw param through to the client app.
 */
import ClaudishPage, { generateMetadata } from '@/app/claudish/page';
import { ClaudishApp } from '@/components/claudish/claudish-app';
import { encodeShare } from '@/lib/claudish/share-codec';

const validT = () => {
  const { url } = encodeShare(
    { direction: 'en2cl', source: 'Hello.', target: 'Greetings — formally.' },
    { baseUrl: '/claudish' }
  );
  return new URL(url, 'https://x.test').searchParams.get('t') as string;
};

describe('generateMetadata', () => {
  it('returns empty metadata with no share param (layout defaults win)', async () => {
    expect(await generateMetadata({ searchParams: Promise.resolve({}) })).toEqual({});
  });

  it('returns empty metadata for a garbage share param', async () => {
    expect(
      await generateMetadata({ searchParams: Promise.resolve({ t: '!!garbage!!' }) })
    ).toEqual({});
  });

  it('points OG + twitter images at the dynamic card for a valid share param', async () => {
    const t = validT();
    const meta = await generateMetadata({ searchParams: Promise.resolve({ t }) });
    const ogUrl = `/claudish/og?t=${encodeURIComponent(t)}`;
    expect(meta.openGraph?.images).toEqual([{ url: ogUrl, width: 1200, height: 630 }]);
    expect(meta.twitter?.images).toEqual([ogUrl]);
    // The canonical stays bare regardless of the share param.
    expect(meta.alternates?.canonical ?? undefined).toBeUndefined();
  });
});

describe('ClaudishPage', () => {
  it('renders the app with the share param threaded through', async () => {
    const jsx = await ClaudishPage({ searchParams: Promise.resolve({ t: 'abc' }) });
    expect(jsx.type).toBe(ClaudishApp);
    expect(jsx.props.shareParam).toBe('abc');
  });

  it('renders the app bare without a param', async () => {
    const jsx = await ClaudishPage({ searchParams: Promise.resolve({}) });
    expect(jsx.props.shareParam).toBeUndefined();
  });
});
