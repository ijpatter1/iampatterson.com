export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
}

export const products: Product[] = [
  {
    id: 'tuna-plush',
    name: 'Tuna Plush Toy',
    price: 24.99,
    description: 'The original Tuna plush. Soft, judgmental, and ready for your couch.',
    category: 'toys',
  },
  {
    id: 'tuna-calendar',
    name: 'Tuna 2026 Calendar',
    price: 19.99,
    description:
      '12 months of AI-generated Tuna art. Every image created with fine-tuned FLUX models.',
    category: 'prints',
  },
  {
    id: 'tuna-pin-set',
    name: 'Tuna Enamel Pin Set',
    price: 14.99,
    description: 'Four pins. Four moods. All Tuna.',
    category: 'accessories',
  },
  {
    id: 'tuna-tote',
    name: 'Tuna Tote Bag',
    price: 29.99,
    description: 'Carry your groceries with the quiet confidence of a famous dog.',
    category: 'bags',
  },
  {
    id: 'tuna-ornament',
    name: 'Tuna Holiday Ornament',
    price: 12.99,
    description: 'For the tree that deserves better than generic baubles.',
    category: 'seasonal',
  },
  {
    id: 'tuna-mug',
    name: 'Tuna Mug',
    price: 17.99,
    description: 'Start every morning with Tuna staring at you. As nature intended.',
    category: 'drinkware',
  },
];

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getRelatedProducts(id: string, count: number = 2): Product[] {
  return products.filter((p) => p.id !== id).slice(0, count);
}
