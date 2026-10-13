/**
 * Homepage copy lives in content modules so a wording change is a one-file
 * edit. These tests check the copy rules that can be checked by reading
 * strings.
 */
import { CERTIFICATIONS } from '@/lib/content/certifications';
import { DONE_WHERE } from '@/lib/content/done-where';
import { HERO, REVIEW_HREF } from '@/lib/content/hero';
import { NETWORKS, NETWORKS_LABEL } from '@/lib/content/networks';
import { PROBLEMS, PROBLEMS_EYEBROW, PROBLEM_LABELS } from '@/lib/content/problems';
import { REVIEW, REVIEW_PRICE } from '@/lib/content/review';
import { WHY_IT_MATTERS } from '@/lib/content/stats';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const ALL_COPY = strings([
  HERO,
  WHY_IT_MATTERS,
  PROBLEMS_EYEBROW,
  PROBLEM_LABELS,
  PROBLEMS,
  REVIEW,
  DONE_WHERE,
  NETWORKS_LABEL,
  NETWORKS,
  CERTIFICATIONS,
]);

describe('homepage copy rules', () => {
  it('has copy to check', () => {
    expect(ALL_COPY.length).toBeGreaterThan(40);
  });

  it('uses no em dash or en dash anywhere', () => {
    expect(ALL_COPY.filter((s) => /[—–]/.test(s))).toEqual([]);
  });

  it('never says "Looker Studio": Google retired the name', () => {
    expect(ALL_COPY.filter((s) => /looker studio/i.test(s))).toEqual([]);
  });

  it('uses none of the banned filler words', () => {
    const banned =
      /\b(leverage|leverages|leveraging|seamless|seamlessly|robust|cutting-edge|world-class)\b/i;
    expect(ALL_COPY.filter((s) => banned.test(s))).toEqual([]);
  });

  it('ships no bracketed placeholder', () => {
    expect(ALL_COPY.filter((s) => /\[[A-Z ·]+\]/.test(s))).toEqual([]);
  });
});

describe('the priced first step', () => {
  // The page exists to offer one priced first step. An unpriced offer, or a
  // price that has drifted from the single constant, defeats it.
  it('states a dollar price on the review', () => {
    expect(REVIEW_PRICE).toMatch(/^\$\d{1,3}(,\d{3})*$/);
    expect(REVIEW.priceLine).toBe(`Fixed price · ${REVIEW_PRICE}`);
  });

  it('sends every review call to action to the contact page with the review intent', () => {
    expect(REVIEW_HREF).toBe('/contact?intent=review');
  });
});

describe('homepage content shape', () => {
  it('gives three problems, numbered in order', () => {
    expect(PROBLEMS.map((p) => p.num)).toEqual(['01', '02', '03']);
  });

  it('shows the source line with the two stat figures', () => {
    expect(WHY_IT_MATTERS.tiles).toHaveLength(2);
    expect(WHY_IT_MATTERS.source).toBe('Source: Google, September 2026');
  });

  it('lists four places and five networks', () => {
    expect(DONE_WHERE.cards).toHaveLength(4);
    expect(NETWORKS).toHaveLength(5);
  });

  it('has no completed certification and therefore no badge', () => {
    expect(CERTIFICATIONS.completed).toEqual([]);
    expect(CERTIFICATIONS.upNext).toHaveLength(5);
  });
});
