/**
 * Tuna Shop product catalog, Phase 9F.
 *
 * Mirrors `docs/input_artifacts/design_handoff_ecommerce/app/data.js` verbatim.
 * Six SKUs mapping to real products on tunameltsmyheart.com. Replaces the
 * pre-9F placeholder catalog (`tuna-plush` / `tuna-tote` / etc.), the IDs
 * and prices here are the canonical shop catalog.
 *
 * Fields:
 * - `id`, `name`, `price`, `category`, core SKU identity.
 * - `blurb`, sentence-cased brand-voice product description (UAT r2
 *   item 18: the pre-9F prototype's all-lowercase prose read unprofessional
 *   on multi-sentence blocks; switched to sentence case while keeping the
 *   warm/casual register).
 * - `tag`, optional display tag (`bestseller` / `new` / `one of one` /
 *   `bundle`). `null` for no tag.
 * - `palette`, three hex colors. Phase 9F used these as the placeholder
 *   palette-tile treatment; Phase 10d D8.f swapped real product photography
 *   in via `image`. The palette stays so the cart-line thumbnail's fallback
 *   skeleton and any future card background wash can reuse the SKU-specific
 *   colour key.
 * - `image`, `{ src, alt }` for the product photograph under `public/shop/`.
 *   Rendered via `next/image` at 4:5 on the listing card and 1:1 on the
 *   detail hero. Added 2026-04-24 (Phase 10d D8.f).
 * - `imageLabel`, short display label shown as a mono caption overlay on
 *   the photograph — keeps the terminal-aesthetic signature that the
 *   placeholder treatment established.
 */
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  blurb: string;
  tag: 'bestseller' | 'new' | 'one of one' | 'bundle' | null;
  palette: [string, string, string];
  image: { src: string; alt: string };
  imageLabel: string;
}

const productSeeds: Product[] = [
  {
    id: 'tuna-plush-classic',
    name: 'Tuna Plush',
    price: 26.0,
    category: 'plush',
    tag: 'bestseller',
    blurb:
      "Handmade velvet plush. Moldable body, bendable legs, so if Tuna's ears flop the wrong way you can just reform him. ICTI-certified factory. 12in nose-to-tail.",
    palette: ['#E8D8BD', '#8A6A4A', '#3B2A1E'],
    image: {
      src: '/shop/tuna-plush-classic.webp',
      alt: 'Tuna plush in blue cardigan with red heart bowtie, retail tag visible.',
    },
    imageLabel: 'PRODUCT · tuna plush · classic · 12in',
  },
  {
    id: 'tuna-calendar-2026',
    name: '2026 Tuna Calendar',
    price: 14.0,
    category: 'calendar',
    tag: 'new',
    blurb:
      "Twelve months of Tuna. This year's theme is decades. AI-generated, because Tuna is fifteen and retired from photoshoots. He does look sharp in a leisure suit.",
    palette: ['#F3DFA8', '#C4703A', '#2B2424'],
    image: {
      src: '/shop/tuna-calendar-2026.webp',
      alt: 'Tuna Melts My Heart 2026 calendar cover. Tuna in sunglasses against a Mondrian-style colour-block background.',
    },
    imageLabel: 'PRODUCT · 2026 wall calendar · 11×8.5',
  },
  {
    id: 'colin-plush',
    name: 'Colin Plush',
    price: 16.0,
    category: 'plush',
    tag: null,
    blurb:
      "Tuna's best friend Colin, from Monster Factory. Licensed exclusive to our shop. Soft, judgemental, excellent hugger.",
    palette: ['#D7C4A8', '#6F5236', '#2B2424'],
    image: {
      src: '/shop/colin-plush.webp',
      alt: 'Colin plush, a round green-faced monster character with googly eyes peeking out of a red onesie.',
    },
    imageLabel: 'PRODUCT · colin plush · 10in',
  },
  {
    id: 'tuna-plush-pi',
    name: 'Perfectly Imperfect Plush',
    price: 24.0,
    category: 'plush',
    tag: 'one of one',
    blurb:
      'The ones that came out a little weird. A short leg, a lopsided eye, a tail that curls wrong. Each is one of one. Each goes home with someone.',
    palette: ['#EADBBF', '#A87145', '#C4703A'],
    image: {
      src: '/shop/tuna-plush-pi.webp',
      alt: 'A Perfectly Imperfect Tuna plush with a slightly skewed face and crooked smile, in blue cardigan with red inner shirt and heart bowtie.',
    },
    imageLabel: 'PRODUCT · PI plush · variant #0247',
  },
  {
    id: 'tuna-cameo',
    name: 'Cameo from Tuna',
    price: 40.0,
    category: 'personalized',
    tag: null,
    blurb:
      'A personalized video from Tuna, delivered via Cameo. Birthdays, pep talks, breakup announcements. Usually 2–5 days.',
    palette: ['#2B2424', '#C4703A', '#F3DFA8'],
    image: {
      src: '/shop/tuna-cameo.webp',
      alt: 'Tuna mid-action on a Cameo marketing still, head tilted up, with the Cameo logo in the corner.',
    },
    imageLabel: 'PRODUCT · cameo · 30s personalized video',
  },
  {
    id: 'tuna-combo',
    name: 'Plush + Calendar',
    price: 32.0,
    category: 'bundle',
    tag: 'bundle',
    blurb:
      'One Tuna plush and the 2026 calendar. Saves you $8, which is a reasonable percentage of a tuna.',
    palette: ['#F3DFA8', '#8A6A4A', '#C4703A'],
    image: {
      src: '/shop/tuna-combo.webp',
      alt: 'Tuna plush and the 2026 Tuna calendar side by side in one studio shot.',
    },
    imageLabel: 'PRODUCT · bundle · plush + calendar',
  },
];

export const products: Product[] = productSeeds;

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getRelatedProducts(id: string, count: number = 2): Product[] {
  return products.filter((p) => p.id !== id).slice(0, count);
}
