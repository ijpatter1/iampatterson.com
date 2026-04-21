/**
 * Tuna Shop product catalog — Phase 9F.
 *
 * Mirrors `docs/input_artifacts/design_handoff_ecommerce/app/data.js` verbatim.
 * Six SKUs mapping to real products on tunameltsmyheart.com. Replaces the
 * pre-9F placeholder catalog (`tuna-plush` / `tuna-tote` / etc.) — the IDs
 * and prices here are the canonical shop catalog.
 *
 * Fields:
 * - `id`, `name`, `price`, `category` — core SKU identity.
 * - `blurb` — lowercase brand-voice product description per prototype.
 * - `tag` — optional display tag (`bestseller` / `new` / `one of one` /
 *   `bundle`). `null` for no tag.
 * - `palette` — three hex colors, used by the palette-tile placeholder
 *   treatment on listing cards (4:5) + product detail hero (1:1). Real
 *   product photography replaces placeholders when the client provides a
 *   photography-on-cream asset kit.
 * - `imageLabel` — short display label shown over the placeholder tile.
 */
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  blurb: string;
  tag: 'bestseller' | 'new' | 'one of one' | 'bundle' | null;
  palette: [string, string, string];
  imageLabel: string;
  /**
   * Backwards-compat alias for `blurb`. Pre-9F consumers (`product-listing.tsx`,
   * `product-detail.tsx`) read `description`; D5/D6 rebuild those components
   * to use `blurb` directly and this alias can be removed.
   */
  description: string;
}

type ProductSeed = Omit<Product, 'description'>;

const productSeeds: ProductSeed[] = [
  {
    id: 'tuna-plush-classic',
    name: 'Tuna Plush',
    price: 26.0,
    category: 'plush',
    tag: 'bestseller',
    blurb:
      "handmade velvet plush. moldable body, bendable legs, so if tuna's ears flop the wrong way you can just reform him. ICTI-certified factory. 12in nose-to-tail.",
    palette: ['#E8D8BD', '#8A6A4A', '#3B2A1E'],
    imageLabel: 'PRODUCT · tuna plush · classic · 12in',
  },
  {
    id: 'tuna-calendar-2026',
    name: '2026 Tuna Calendar',
    price: 14.0,
    category: 'calendar',
    tag: 'new',
    blurb:
      "twelve months of tuna. this year's theme is decades. AI-generated, because tuna is fifteen and retired from photoshoots. he does look sharp in a leisure suit.",
    palette: ['#F3DFA8', '#C4703A', '#2B2424'],
    imageLabel: 'PRODUCT · 2026 wall calendar · 11×8.5',
  },
  {
    id: 'colin-plush',
    name: 'Colin Plush',
    price: 16.0,
    category: 'plush',
    tag: null,
    blurb:
      "tuna's best friend colin, from monster factory. licensed exclusive to our shop. soft, judgemental, excellent hugger.",
    palette: ['#D7C4A8', '#6F5236', '#2B2424'],
    imageLabel: 'PRODUCT · colin plush · 10in',
  },
  {
    id: 'tuna-plush-pi',
    name: 'Perfectly Imperfect Plush',
    price: 24.0,
    category: 'plush',
    tag: 'one of one',
    blurb:
      'the ones that came out a little weird. a short leg, a lopsided eye, a tail that curls wrong. each is one of one. each goes home with someone.',
    palette: ['#EADBBF', '#A87145', '#C4703A'],
    imageLabel: 'PRODUCT · PI plush · variant #0247',
  },
  {
    id: 'tuna-cameo',
    name: 'Cameo from Tuna',
    price: 40.0,
    category: 'personalized',
    tag: null,
    blurb:
      'a personalized video from tuna, delivered via cameo. birthdays, pep talks, breakup announcements. usually 2–5 days.',
    palette: ['#2B2424', '#C4703A', '#F3DFA8'],
    imageLabel: 'PRODUCT · cameo · 30s personalized video',
  },
  {
    id: 'tuna-combo',
    name: 'Plush + Calendar',
    price: 32.0,
    category: 'bundle',
    tag: 'bundle',
    blurb:
      'one tuna plush and the 2026 calendar. saves you $8, which is a reasonable percentage of a tuna.',
    palette: ['#F3DFA8', '#8A6A4A', '#C4703A'],
    imageLabel: 'PRODUCT · bundle · plush + calendar',
  },
];

export const products: Product[] = productSeeds.map((p) => ({ ...p, description: p.blurb }));

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getRelatedProducts(id: string, count: number = 2): Product[] {
  return products.filter((p) => p.id !== id).slice(0, count);
}
