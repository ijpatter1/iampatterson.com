/**
 * sessionStorage persistence for SessionState.
 *
 * Storage key: `iampatterson.session_state` (UX_PIVOT_SPEC §3.6).
 * Tab-scoped by design — returning visitors start fresh, mirroring the
 * `_iap_sid` cookie's session semantics.
 */
import { createInitialSessionState } from '@/lib/session-state/derive';
import {
  SESSION_STATE_STORAGE_KEY,
  loadSessionState,
  saveSessionState,
} from '@/lib/session-state/storage';

const FIXED_NOW = new Date('2026-04-19T18:00:00.000Z');

describe('SessionState storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('uses the canonical storage key from the UX spec', () => {
    expect(SESSION_STATE_STORAGE_KEY).toBe('iampatterson.session_state');
  });

  it('round-trips a state through save/load', () => {
    const state = createInitialSessionState('sid-round-trip', FIXED_NOW);
    saveSessionState(state);
    const loaded = loadSessionState();
    expect(loaded).toEqual(state);
  });

  it('returns null when no state has been saved', () => {
    expect(loadSessionState()).toBeNull();
  });

  it('returns null when the stored value is malformed JSON', () => {
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, '{not json');
    expect(loadSessionState()).toBeNull();
  });

  it('returns null when the stored value is JSON but not the expected shape', () => {
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadSessionState()).toBeNull();
  });

  it('saveSessionState swallows quota / security errors silently', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    try {
      expect(() => saveSessionState(createInitialSessionState('sid', FIXED_NOW))).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
