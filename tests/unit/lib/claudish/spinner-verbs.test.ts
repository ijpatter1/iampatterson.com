/**
 * Claudish translator — spinner verbs (feat/claudish M2).
 *
 * The loading state cycles Claude Code's own spinner verbs. Hand-picked
 * list (spec: "observed in Ian's own sessions"; the corpus miner can
 * refresh it later — flagged corpus-replaceable). Gerund + ellipsis form,
 * no duplicates, enough variety not to loop visibly within one long
 * translation.
 */
import { SPINNER_VERBS } from '@/lib/claudish/spinner-verbs';

describe('SPINNER_VERBS', () => {
  it('has at least 8 verbs for visible variety', () => {
    expect(SPINNER_VERBS.length).toBeGreaterThanOrEqual(8);
  });

  it('uses the gerund-plus-ellipsis form throughout', () => {
    for (const verb of SPINNER_VERBS) {
      expect(verb).toMatch(/^[A-Z][a-z]+ing…$/);
    }
  });

  it('contains no duplicates', () => {
    expect(new Set(SPINNER_VERBS).size).toBe(SPINNER_VERBS.length);
  });
});
