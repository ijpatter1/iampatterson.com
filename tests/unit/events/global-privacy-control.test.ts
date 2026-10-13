/**
 * @jest-environment jsdom
 */
import { isGlobalPrivacyControlEnabled } from '@/lib/events/global-privacy-control';

function setSignal(value: unknown): void {
  Object.defineProperty(navigator, 'globalPrivacyControl', { value, configurable: true });
}

afterEach(() => {
  delete (navigator as unknown as { globalPrivacyControl?: unknown }).globalPrivacyControl;
});

// Global Privacy Control is a standing opt-out the visitor set in their
// browser. This site honors it, so detection has to be
// exact: only the boolean `true` the specification defines counts. A browser
// that does not implement the signal leaves the property undefined, and that
// must never read as an opt-out or as an opt-in.
describe('isGlobalPrivacyControlEnabled', () => {
  it('is true when the browser sends the signal', () => {
    setSignal(true);
    expect(isGlobalPrivacyControlEnabled()).toBe(true);
  });

  it('is false when the browser does not implement the signal', () => {
    expect(isGlobalPrivacyControlEnabled()).toBe(false);
  });

  it('is false when the signal is explicitly off', () => {
    setSignal(false);
    expect(isGlobalPrivacyControlEnabled()).toBe(false);
  });

  it('does not treat a truthy non-boolean as the signal', () => {
    setSignal('1');
    expect(isGlobalPrivacyControlEnabled()).toBe(false);
  });
});
