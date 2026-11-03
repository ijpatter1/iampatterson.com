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
import { LIVE_STRIP, PROOF } from '@/lib/content/proof';
import { HOW_WE_WORK, REVIEW_COLUMNS, REVIEW_PAGE_HREF, REVIEW_PRICE } from '@/lib/content/review';
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
  HOW_WE_WORK,
  REVIEW_COLUMNS,
  DONE_WHERE,
  NETWORKS_LABEL,
  NETWORKS,
  CERTIFICATIONS,
  PROOF,
  LIVE_STRIP,
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

describe('the practice name', () => {
  // The practice is I am Patterson everywhere, as on the LinkedIn profile.
  it('never says "Patterson Consulting"', () => {
    expect(ALL_COPY.filter((s) => /patterson consulting/i.test(s))).toEqual([]);
    expect(HERO.eyebrowLeft).toBe('I am Patterson · Atlanta');
  });
});

describe('the priced first step', () => {
  // The review is the one priced entry. Its price is a starting price with
  // no stated duration, so a scope that grows does not contradict the page.
  it('states a starting dollar price on the review, from the single constant', () => {
    expect(REVIEW_PRICE).toMatch(/^\$\d{1,3}(,\d{3})*$/);
    expect(HOW_WE_WORK.steps[0].price).toBe(`From ${REVIEW_PRICE}`);
  });

  it('states no duration for the review anywhere', () => {
    expect(ALL_COPY.filter((s) => /two-day|\bdays?\b|\bhours?\b|fixed price/i.test(s))).toEqual([]);
  });

  it('sends the review calls to action to the contact page with the review intent', () => {
    expect(REVIEW_HREF).toBe('/contact?intent=review');
  });

  it('links the review step to the page that sets the review out', () => {
    expect(REVIEW_PAGE_HREF).toBe('/review');
    expect(HOW_WE_WORK.steps[0].link?.href).toBe(REVIEW_PAGE_HREF);
  });
});

describe('how teams work with me', () => {
  // The banner's three steps, in the banner's order and words.
  it('is the Review, Build, Lead ladder with the banner lines', () => {
    expect(HOW_WE_WORK.steps.map((s) => [s.num, s.label, s.line])).toEqual([
      ['01', 'Review', 'What your tracking misses, and what to fix'],
      ['02', 'Build', 'Data you own, and AI your team can rely on'],
      ['03', 'Lead', "Senior leadership, where there's a fit"],
    ]);
  });

  // Build is where the AI is offered, so it says who controls it.
  it('says what the AI does and who controls it', () => {
    expect(HOW_WE_WORK.steps[1].body).toContain('your team asks about spend and sales');
    expect(HOW_WE_WORK.steps[1].body).toContain('I control what the AI can see and change');
  });

  it('prices only the review', () => {
    expect(HOW_WE_WORK.steps.filter((s) => s.price).map((s) => s.label)).toEqual(['Review']);
  });
});

describe('homepage content shape', () => {
  it('gives three problems, numbered in order', () => {
    expect(PROBLEMS.map((p) => p.num)).toEqual(['01', '02', '03']);
  });

  // The profile's About asks these three questions; the page answers them.
  it("titles the problems with the profile's three questions", () => {
    expect(PROBLEMS_EYEBROW).toBe('What I get called for · Three questions');
    expect(PROBLEMS.map((p) => p.title)).toEqual([
      'Is the budget going to the right places?',
      'Does anybody trust these numbers?',
      'Who owns this data?',
    ]);
  });

  // The 2026 client is not named on the site.
  it('keeps the 2026 work as "An ad tech startup"', () => {
    expect(DONE_WHERE.cards.map((c) => c.name)).toContain('An ad tech startup');
    expect(ALL_COPY.filter((s) => /adzeta/i.test(s))).toEqual([]);
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

describe('what the Proof copy says about the pipeline', () => {
  // The ID the browser shows is assigned by the server on receipt.
  it('does not call the event ID a deduplication key', () => {
    expect(strings([PROOF, LIVE_STRIP]).filter((s) => /dedup/i.test(s))).toEqual([]);
    expect(LIVE_STRIP.eventIdLabel).toBe('pipeline id');
  });

  it('does not say every event is going through to BigQuery "right now"', () => {
    expect(PROOF.body).not.toMatch(/right now/i);
    expect(PROOF.body).toContain('No tag fires until you choose.');
    expect(PROOF.body).toContain('Only the record of your choice gets through');
  });

  it('names the warehouse table the server container writes to', () => {
    expect(LIVE_STRIP.warehouse).toBe('iampatterson_raw.events_raw');
  });
});
