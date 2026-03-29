import { products, getProduct, getRelatedProducts } from '@/lib/demo/products';

describe('Product data', () => {
  it('has 6 products', () => {
    expect(products).toHaveLength(6);
  });

  it('each product has required fields', () => {
    for (const p of products) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.price).toBeGreaterThan(0);
      expect(p.description).toBeTruthy();
      expect(p.category).toBeTruthy();
    }
  });

  it('product IDs are unique', () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getProduct', () => {
  it('returns a product by ID', () => {
    const p = getProduct('tuna-plush');
    expect(p?.name).toBe('Tuna Plush Toy');
    expect(p?.price).toBe(24.99);
  });

  it('returns undefined for unknown ID', () => {
    expect(getProduct('nonexistent')).toBeUndefined();
  });
});

describe('getRelatedProducts', () => {
  it('returns products excluding the given ID', () => {
    const related = getRelatedProducts('tuna-plush');
    expect(related).toHaveLength(2);
    expect(related.every((p) => p.id !== 'tuna-plush')).toBe(true);
  });

  it('respects the count parameter', () => {
    const related = getRelatedProducts('tuna-plush', 3);
    expect(related).toHaveLength(3);
  });
});
