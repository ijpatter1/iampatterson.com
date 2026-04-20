/**
 * Pipeline bleed-once-per-session flag helpers.
 */
import {
  PIPELINE_BLEED_CONSUMED_STORAGE_KEY,
  hasPipelineBleedConsumed,
  markPipelineBleedConsumed,
} from '@/components/home/pipeline-bleed-consumed';

describe('pipeline-bleed-consumed', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('reads false when the storage key is unset (fresh session)', () => {
    expect(hasPipelineBleedConsumed()).toBe(false);
  });

  it('writes "1" to the canonical sessionStorage key on mark()', () => {
    markPipelineBleedConsumed();
    expect(window.sessionStorage.getItem(PIPELINE_BLEED_CONSUMED_STORAGE_KEY)).toBe('1');
  });

  it('reads true after mark() has written the flag', () => {
    markPipelineBleedConsumed();
    expect(hasPipelineBleedConsumed()).toBe(true);
  });

  it('tolerates sessionStorage throwing on getItem (strict-privacy mode)', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError');
    };
    try {
      expect(hasPipelineBleedConsumed()).toBe(false);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it('tolerates sessionStorage throwing on setItem (quota exceeded)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => markPipelineBleedConsumed()).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
