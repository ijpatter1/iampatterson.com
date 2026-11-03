export interface StatTile {
  figure: string;
  text: string;
}

export interface Evidence {
  tiles: StatTile[];
  source: string;
}

/**
 * Google's two figures, shown under the first question ("Is the budget going
 * to the right places?") since 2026-11-03, when Ian dropped the "Why it
 * matters" section. Both are Google's; the source line stays with them.
 */
export const BUDGET_FIGURES: Evidence = {
  tiles: [
    {
      figure: '11%',
      text: 'more Search conversions for advertisers using enhanced conversions, against standard imports.',
    },
    {
      figure: '26%',
      text: 'more incremental ROAS for advertisers who connect offline and app data through Data Manager.',
    },
  ],
  source: 'Source: Google, September 2026',
};
