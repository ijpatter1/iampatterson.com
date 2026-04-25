/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { useStorageInspector } from '@/hooks/useStorageInspector';

function clearAllStorage() {
  window.localStorage.clear();
  window.sessionStorage.clear();
  for (const cookie of document.cookie.split(';')) {
    const eqPos = cookie.indexOf('=');
    const name = (eqPos > -1 ? cookie.substring(0, eqPos) : cookie).trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  clearAllStorage();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useStorageInspector', () => {
  it('returns initial snapshot synchronously when enabled', () => {
    document.cookie = '_iap_aid=initial-uuid';
    const { result } = renderHook(() => useStorageInspector(true));
    const names = result.current.entries.map((e) => e.name);
    expect(names).toContain('_iap_aid');
  });

  it('returns the empty snapshot when disabled (overlay closed)', () => {
    document.cookie = '_iap_aid=should-not-be-read';
    const { result } = renderHook(() => useStorageInspector(false));
    expect(result.current.entries).toEqual([]);
  });

  it('detects new cookie writes within the polling tick when enabled', () => {
    const { result } = renderHook(() => useStorageInspector(true));
    expect(result.current.entries.find((e) => e.name === '_ga')).toBeUndefined();
    act(() => {
      document.cookie = '_ga=GA1.1.123.456';
      jest.advanceTimersByTime(1100);
    });
    expect(result.current.entries.find((e) => e.name === '_ga')).toBeDefined();
  });

  it('detects same-tab localStorage writes within the polling tick', () => {
    const { result } = renderHook(() => useStorageInspector(true));
    expect(
      result.current.entries.find((e) => e.name === 'iampatterson.session_state'),
    ).toBeUndefined();
    act(() => {
      window.localStorage.setItem('iampatterson.session_state', '{"foo":"bar"}');
      jest.advanceTimersByTime(1100);
    });
    expect(
      result.current.entries.find((e) => e.name === 'iampatterson.session_state'),
    ).toBeDefined();
  });

  it('detects cross-tab localStorage writes via the native storage event', () => {
    const { result } = renderHook(() => useStorageInspector(true));
    act(() => {
      // Simulate a write from another tab. jsdom does not fire `storage` events for
      // same-tab writes, so we set the value AND dispatch the event explicitly to
      // mirror what the platform would emit cross-tab.
      window.localStorage.setItem('iampatterson.future_thing', 'cross-tab-value');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'iampatterson.future_thing',
          newValue: 'cross-tab-value',
        }),
      );
    });
    expect(
      result.current.entries.find((e) => e.name === 'iampatterson.future_thing'),
    ).toBeDefined();
  });

  it('stops polling when enabled flips from true to false', () => {
    const { result, rerender } = renderHook(({ on }) => useStorageInspector(on), {
      initialProps: { on: true },
    });
    expect(result.current.entries).toEqual([]);
    rerender({ on: false });
    act(() => {
      document.cookie = '_iap_aid=should-not-be-detected';
      jest.advanceTimersByTime(5000);
    });
    // After disable, snapshot is reset to empty and ticks no longer read storage.
    expect(result.current.entries).toEqual([]);
  });

  it('resumes reading when enabled flips from false back to true', () => {
    document.cookie = '_iap_aid=present';
    const { result, rerender } = renderHook(({ on }) => useStorageInspector(on), {
      initialProps: { on: false },
    });
    expect(result.current.entries).toEqual([]);
    rerender({ on: true });
    expect(result.current.entries.find((e) => e.name === '_iap_aid')).toBeDefined();
  });

  it('does not invoke setState when no diff between consecutive ticks (snapshot identity preserved)', () => {
    document.cookie = '_iap_aid=stable';
    const { result } = renderHook(() => useStorageInspector(true));
    const first = result.current;
    act(() => {
      jest.advanceTimersByTime(3300);
    });
    // Snapshot reference is preserved when nothing changed across ticks (no churn).
    expect(result.current).toBe(first);
  });

  it('cleans up the interval and storage listener on unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useStorageInspector(true));
    unmount();
    const removedStorage = removeSpy.mock.calls.some(([type]) => type === 'storage');
    expect(removedStorage).toBe(true);
    removeSpy.mockRestore();
  });
});
