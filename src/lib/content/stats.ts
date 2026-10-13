export interface StatTile {
  figure: string;
  text: string;
}

/** "Why it matters" copy. Both figures are Google's; the source line stays with them. */
export const WHY_IT_MATTERS = {
  eyebrow: 'Why it matters',
  body: 'Meta and Google run the bidding on the conversion data you send them. What usually arrives is less than you have: browser-only events, some of them twice, and nothing from the sales that close off the site.',
  tiles: [
    {
      figure: '11%',
      text: 'more Search conversions for advertisers using enhanced conversions, against standard imports.',
    },
    {
      figure: '26%',
      text: 'more incremental ROAS for advertisers who connect offline and app data through Data Manager.',
    },
  ] satisfies StatTile[],
  source: 'Source: Google, September 2026',
} as const;
