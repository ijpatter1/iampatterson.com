/**
 * @jest-environment jsdom
 *
 * Claudish translator — route layout (feat/claudish M2, phase E2).
 * Server Component: static metadata (absolute title bypasses the site
 * template — a Translate spoof with a consulting suffix reads wrong in
 * the unfurl) + the [data-page]/[data-skin] palette scope wrapper.
 */
import { render } from '@testing-library/react';

import ClaudishLayout, { metadata } from '@/app/claudish/layout';

describe('ClaudishLayout metadata', () => {
  it('uses an absolute title without the site template suffix', () => {
    expect(metadata.title).toEqual({ absolute: 'Claudish Translate' });
  });

  it('sets the bare canonical so the unbounded ?t= space collapses to one URL', () => {
    expect(metadata.alternates?.canonical).toBe('https://iampatterson.com/claudish');
  });

  it('carries openGraph + twitter defaults', () => {
    expect(metadata.openGraph?.url).toBe('https://iampatterson.com/claudish');
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});

describe('ClaudishLayout scope wrapper', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CLAUDISH_SKIN;
  });

  it('wraps children in the data-page scope with the clone skin by default', () => {
    const { container } = render(
      <ClaudishLayout>
        <span>child</span>
      </ClaudishLayout>
    );
    const scope = container.querySelector('[data-page="claudish"]');
    expect(scope).not.toBeNull();
    expect(scope).toHaveAttribute('data-skin', 'clone');
    expect(scope).toHaveTextContent('child');
  });

  it('renders the parse-time ?t= strip script inside the scope', () => {
    const { container } = render(
      <ClaudishLayout>
        <span>child</span>
      </ClaudishLayout>
    );
    const script = container.querySelector('[data-page="claudish"] script');
    expect(script).not.toBeNull();
    expect(script?.innerHTML).toContain("searchParams.delete('t')");
    expect(script?.innerHTML).toContain('history.replaceState(history.state');
  });

  it('switches to the personal skin via NEXT_PUBLIC_CLAUDISH_SKIN (the takedown flip)', () => {
    process.env.NEXT_PUBLIC_CLAUDISH_SKIN = 'personal';
    const { container } = render(
      <ClaudishLayout>
        <span>child</span>
      </ClaudishLayout>
    );
    expect(container.querySelector('[data-page="claudish"]')).toHaveAttribute(
      'data-skin',
      'personal'
    );
  });
});
