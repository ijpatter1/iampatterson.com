/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { InlineDiagnostic } from '@/components/demo/reveal/inline-diagnostic';

describe('InlineDiagnostic', () => {
  it('renders children inside the styled wrapper', () => {
    render(
      <InlineDiagnostic tag="WHAT JUST HAPPENED" title="from click to dashboard">
        <p>diagnostic body</p>
      </InlineDiagnostic>,
    );
    expect(screen.getByText('diagnostic body')).toBeInTheDocument();
  });

  it('renders the tag and title when provided', () => {
    render(
      <InlineDiagnostic
        tag="WHAT JUST HAPPENED · TIER 2 + 3"
        title="from click to dashboard · 840ms"
      >
        <div>x</div>
      </InlineDiagnostic>,
    );
    expect(screen.getByText('WHAT JUST HAPPENED · TIER 2 + 3')).toBeInTheDocument();
    expect(screen.getByText('from click to dashboard · 840ms')).toBeInTheDocument();
  });

  it('omits tag and title when not provided', () => {
    render(
      <InlineDiagnostic>
        <div>x</div>
      </InlineDiagnostic>,
    );
    const root = document.querySelector('[data-inline-diagnostic]') as HTMLElement;
    expect(root.querySelector('[data-id-tag]')).toBeNull();
    expect(root.querySelector('[data-id-title]')).toBeNull();
  });

  it('uses a section element with data-inline-diagnostic attribute', () => {
    render(
      <InlineDiagnostic tag="t" title="x">
        <div>y</div>
      </InlineDiagnostic>,
    );
    const root = document.querySelector('section[data-inline-diagnostic]');
    expect(root).not.toBeNull();
  });

  it('renders the scanline texture layer aria-hidden', () => {
    render(
      <InlineDiagnostic tag="t" title="x">
        <div>y</div>
      </InlineDiagnostic>,
    );
    const scanlines = document.querySelector('[data-id-scanlines]');
    expect(scanlines).not.toBeNull();
    expect(scanlines?.getAttribute('aria-hidden')).toBe('true');
  });

  it('accepts and applies a custom className', () => {
    render(
      <InlineDiagnostic tag="t" title="x" className="custom-class extra">
        <div>y</div>
      </InlineDiagnostic>,
    );
    const root = document.querySelector('[data-inline-diagnostic]') as HTMLElement;
    expect(root.className).toMatch(/custom-class/);
    expect(root.className).toMatch(/extra/);
  });

  it('uses the warm Tuna Shop terminal palette (near-black bg, warm-cream ink, amber accent)', () => {
    render(
      <InlineDiagnostic tag="t" title="x">
        <div>y</div>
      </InlineDiagnostic>,
    );
    const root = document.querySelector('[data-inline-diagnostic]') as HTMLElement;
    // Background is near-black (#0D0B09); ink is warm cream (#EAD9BC).
    expect(root.className).toMatch(/#0D0B09|bg-\[#0D0B09\]/i);
    expect(root.className).toMatch(/#EAD9BC|text-\[#EAD9BC\]/i);
  });
});
