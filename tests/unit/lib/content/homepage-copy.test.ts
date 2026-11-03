/**
 * Homepage copy lives in content modules so a wording change is a one-file
 * edit. These tests check the copy rules that can be checked by reading
 * strings.
 */
import { CERTIFICATIONS } from '@/lib/content/certifications';
import { DONE_WHERE } from '@/lib/content/done-where';
import { HERO } from '@/lib/content/hero';
import { NETWORKS, NETWORKS_LABEL } from '@/lib/content/networks';
import { PROBLEMS, PROBLEMS_EYEBROW, PROBLEM_LABELS } from '@/lib/content/problems';
import { LIVE_STRIP, PROOF } from '@/lib/content/proof';
import {
  BOOK_REVIEW_HREF,
  HOW_WE_WORK,
  REVIEW_COLUMNS,
  REVIEW_PAGE_HREF,
  REVIEW_PRICE,
} from '@/lib/content/review';
import { REVIEW_PAGE } from '@/lib/content/review-page';
import { CUSTOMER_FIGURES, OWNERSHIP_FIGURES, TRUST_FIGURES } from '@/lib/content/stats';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const ALL_COPY = strings([
  HERO,
  CUSTOMER_FIGURES,
  TRUST_FIGURES,
  OWNERSHIP_FIGURES,
  PROBLEMS_EYEBROW,
  PROBLEM_LABELS,
  PROBLEMS,
  HOW_WE_WORK,
  REVIEW_COLUMNS,
  REVIEW_PAGE,
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

  // The review states no effort duration anywhere. The one timing claim is
  // the turnaround on /review, counted from full access (Ian, 2026-11-03).
  it('states no effort duration; the only timing is the approved turnaround', () => {
    const timing = /two-day|\bdays?\b|\bhours?\b|\bweeks?\b|fortnight|fixed price/i;
    expect(
      ALL_COPY.filter(
        (s) => s !== REVIEW_PAGE.turnaround && !/six figures a week/.test(s) && timing.test(s),
      ),
    ).toEqual([]);
  });

  // 15.10: every review link goes to the page that sets the review out; only
  // the booking buttons go to the contact page, with the review intent.
  it('sends every review call to action to the review page, and booking to contact', () => {
    expect(REVIEW_PAGE_HREF).toBe('/review');
    expect(BOOK_REVIEW_HREF).toBe('/contact?intent=review');
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
    // The profile's wording: governance the client keeps, set by Ian.
    expect(HOW_WE_WORK.steps[1].body).toContain(
      'I set the rules for what the AI can see and change',
    );
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
  // The first asks about the customers the platforms bid on, not which
  // channel gets the budget (Ian, 2026-11-03), so its answer, sending the
  // platforms your real conversions with their value, replies to it directly.
  it("titles the problems with the profile's three questions", () => {
    expect(PROBLEMS_EYEBROW).toBe('What I get called for · Three questions');
    expect(PROBLEMS.map((p) => p.title)).toEqual([
      'Do the platforms know who our best customers are?',
      'Does anybody trust these numbers?',
      'Who owns this data?',
    ]);
  });

  // The profile's wording: conversions flow back with consent. The page no
  // longer argues that the platforms need more data to bid on.
  it('does not frame the work as feeding the platforms more to bid on', () => {
    expect(PROBLEMS[0].whatIDo).toContain('flow back to the ad platforms with consent.');
    expect(ALL_COPY.filter((s) => /bid on everything|run the bidding/i.test(s))).toEqual([]);
  });

  // The three AI products were the agency's own, not built for its clients.
  it('says the AI products were a build Ian led, apart from the client work', () => {
    const allied = DONE_WHERE.cards.find((c) => c.name === 'Allied Global Marketing')!;
    expect(allied.text).toBe(
      "Senior Director, then VP of Data and Technology. Conversions APIs through server-side GTM for the agency's clients. Led the build of three AI products.",
    );
  });

  // Ian named AdZeta on 2026-11-03, as his LinkedIn profile does.
  it("names AdZeta for the 2026 work, in the profile's terms", () => {
    const adzeta = DONE_WHERE.cards.find((c) => c.name === 'AdZeta')!;
    expect(adzeta.when).toBe('2026');
    expect(adzeta.text).toBe(
      'Head of Engineering and Marketing Science. First-party data turned into predicted lifetime value signals that Google, Meta and TikTok bid on.',
    );
    // The example answers the first question: the platforms bid on the
    // customers worth having, in the profile's words.
    expect(PROBLEMS[0].doneBefore).toMatch(
      /^AdZeta, 2026: predicted lifetime value sent to Google, Meta and TikTok, so their bidding goes after the customers who stick and repurchase\./,
    );
    expect(ALL_COPY.filter((s) => /ad tech startup/i.test(s))).toEqual([]);
  });

  // Owning the data means reporting on it and acting on it, including adding
  // a platform without waiting on a developer. Consent is one clause of that.
  it('makes ownership about control of the data, not only consent', () => {
    const owns = PROBLEMS[2];
    expect(owns.title).toBe('Who owns this data?');
    expect(owns.whatIDo).toContain(
      "Adding an ad platform's Conversions API becomes a change your team makes in a container it controls, not a request in the developer queue",
    );
    expect(owns.whatIDo).toContain('The same data feeds your reporting and your audiences');
    expect(owns.doneBefore).toMatch(/^At UP, the paid program moved through 14 ad platforms/);
    // This site runs Cookiebot, not OneTrust: say so, so "this site" cannot be
    // read as running the setup the sentence before describes.
    expect(owns.doneBefore).toContain(
      'Cookiebot and consent mode on this site: open the overlay and watch it enforce your choice.',
    );
  });

  // Trust is where the page brings in AI: the AI works from the same
  // reconciled table, so its answers can be checked.
  it('brings the AI into the trust question', () => {
    expect(PROBLEMS[1].whatIDo).toContain(
      'The AI sits on that same table, so when your team asks about spend or sales, they can check the answer against numbers they already trust.',
    );
    expect(PROBLEMS[1].doneBefore).toMatch(/^UP Entertainment, a streaming subscription business/);
  });

  // Each question carries two sourced figures. Their wording is checked
  // against the source reports by the private claims check (15.6), not here:
  // the claims rules stay out of this public repo.
  it('backs each question with two sourced figures', () => {
    expect(PROBLEMS.map((p) => p.evidence)).toEqual([
      CUSTOMER_FIGURES,
      TRUST_FIGURES,
      OWNERSHIP_FIGURES,
    ]);
    for (const evidence of [CUSTOMER_FIGURES, TRUST_FIGURES, OWNERSHIP_FIGURES]) {
      expect(evidence.tiles).toHaveLength(2);
      expect(evidence.source).toMatch(/^Sources?: .*2026/);
    }
    expect(TRUST_FIGURES.tiles.map((t) => t.figure)).toEqual(['36%', '49%']);
    expect(TRUST_FIGURES.source).toBe('Sources: MMA, April 2026; IAB, February 2026');
    expect(OWNERSHIP_FIGURES.tiles.map((t) => t.figure)).toEqual(['52%', '20%']);
    // Vendor research is labelled on the page (Ian, 2026-11-03).
    expect(OWNERSHIP_FIGURES.source).toBe(
      'Sources: Supermetrics (vendor survey), 2026; MMA, April 2026',
    );
  });

  // "4 platforms to 14" is said once, under ownership.
  it('says the UP platform count once', () => {
    expect(ALL_COPY.filter((s) => /14 ad platforms|4 platforms to 14/.test(s))).toHaveLength(1);
  });

  it("puts Google's two figures, with their source, under the first question", () => {
    expect(CUSTOMER_FIGURES.tiles.map((t) => t.figure)).toEqual(['11%', '26%']);
    expect(CUSTOMER_FIGURES.source).toBe('Source: Google (vendor data), September 2026');
    expect(PROBLEMS[0].evidence).toBe(CUSTOMER_FIGURES);
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
