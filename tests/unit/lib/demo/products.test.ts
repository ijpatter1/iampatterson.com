import { products } from '@/lib/demo/products';

/**
 * Phase 10d D8.f Pass-1 fix: catalogue-level invariants on the new
 * required `Product.image` field. TypeScript enforces the shape at
 * compile-time, but there's no CI-enforced `tsc --noEmit` gate — so a
 * future SKU added without an `image` block or with a typo in the
 * `src` path could sneak past. These tests are the runtime guard.
 */
describe('Product catalogue invariants', () => {
  it('has exactly six SKUs (the Tuna Shop catalogue)', () => {
    expect(products).toHaveLength(6);
  });

  it('every SKU has a non-empty image.src and image.alt', () => {
    products.forEach((p) => {
      expect(p.image).toBeDefined();
      expect(typeof p.image.src).toBe('string');
      expect(p.image.src.length).toBeGreaterThan(0);
      expect(typeof p.image.alt).toBe('string');
      expect(p.image.alt.length).toBeGreaterThan(0);
    });
  });

  it('every image.src points under /shop/ and ends in .webp', () => {
    products.forEach((p) => {
      expect(p.image.src.startsWith('/shop/')).toBe(true);
      expect(p.image.src.endsWith('.webp')).toBe(true);
    });
  });

  it('every image.src path encodes the SKU id for traceability', () => {
    // Intentional coupling: the filename under /shop/ matches the SKU id
    // so a grep for the SKU finds its asset. Guards against silent
    // reshuffles where an image swap between SKUs would be invisible
    // in code review.
    products.forEach((p) => {
      expect(p.image.src).toContain(p.id);
    });
  });

  it('every SKU has a unique image.src (no shared placeholders)', () => {
    const srcs = products.map((p) => p.image.src);
    expect(new Set(srcs).size).toBe(srcs.length);
  });
});
