export interface Plan {
  id: string;
  name: string;
  price: number;
  itemCount: string;
  description: string;
  popular?: boolean;
  features: string[];
}

export const plans: Plan[] = [
  {
    id: 'pup',
    name: 'The Pup',
    price: 19.99,
    itemCount: '2-3 items',
    description: 'Perfect for the casual Tuna fan.',
    features: ['2-3 Tuna-branded items', 'Free shipping', 'Cancel anytime'],
  },
  {
    id: 'good-boy',
    name: 'The Good Boy',
    price: 34.99,
    itemCount: '4-5 items',
    description: 'The most popular plan.',
    popular: true,
    features: [
      '4-5 items including one exclusive',
      'Free shipping',
      'Early access to new products',
      'Cancel anytime',
    ],
  },
  {
    id: 'big-tuna',
    name: 'The Big Tuna',
    price: 49.99,
    itemCount: '6-7 items',
    description: 'For the committed.',
    features: [
      '6-7 items per box',
      'Early access to all new products',
      'Quarterly limited edition item',
      'Free shipping',
      'Cancel anytime',
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return plans.find((p) => p.id === id);
}
