import { products, getProduct, getRelatedProducts } from '@/lib/demo/products';

describe('Product data', () => {
  it('has 6 products', () => {
    expect(products).toHaveLength(6);
  });

  it('each product has required fields per the Tuna Shop catalog schema', () => {
    for (const p of products) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.price).toBeGreaterThan(0);
      expect(p.blurb).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.palette).toHaveLength(3);
      // imageLabel + tag are required fields; tag may be null
      expect(p.imageLabel).toBeTruthy();
      expect(p.tag === null || typeof p.tag === 'string').toBe(true);
    }
  });

  it('product IDs are unique', () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('IDs match the prototype catalog verbatim', () => {
    const ids = products.map((p) => p.id);
    expect(ids).toEqual([
      'tuna-plush-classic',
      'tuna-calendar-2026',
      'colin-plush',
      'tuna-plush-pi',
      'tuna-cameo',
      'tuna-combo',
    ]);
  });

  it('prices match the prototype catalog', () => {
    const priceById = Object.fromEntries(products.map((p) => [p.id, p.price]));
    expect(priceById).toEqual({
      'tuna-plush-classic': 26,
      'tuna-calendar-2026': 14,
      'colin-plush': 16,
      'tuna-plush-pi': 24,
      'tuna-cameo': 40,
      'tuna-combo': 32,
    });
  });
});

describe('getProduct', () => {
  it('returns the classic plush for its canonical id', () => {
    const p = getProduct('tuna-plush-classic');
    expect(p?.name).toBe('Tuna Plush');
    expect(p?.price).toBe(26);
    expect(p?.tag).toBe('bestseller');
  });

  it('returns undefined for unknown ID', () => {
    expect(getProduct('nonexistent')).toBeUndefined();
  });
});

describe('getRelatedProducts', () => {
  it('returns products excluding the given ID', () => {
    const related = getRelatedProducts('tuna-plush-classic');
    expect(related).toHaveLength(2);
    expect(related.every((p) => p.id !== 'tuna-plush-classic')).toBe(true);
  });

  it('respects the count parameter', () => {
    const related = getRelatedProducts('tuna-plush-classic', 3);
    expect(related).toHaveLength(3);
  });
});
