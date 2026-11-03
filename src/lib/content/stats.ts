export interface StatTile {
  figure: string;
  text: string;
}

export interface Evidence {
  tiles: StatTile[];
  source: string;
}

/**
 * Google's two figures, shown under the first question ("Do the platforms
 * know who our best customers are?") since 2026-11-03, when Ian dropped the "Why it
 * matters" section. Both are Google's; the source line stays with them.
 */
export const CUSTOMER_FIGURES: Evidence = {
  tiles: [
    {
      figure: '11%',
      text: 'more Search conversions on average for advertisers using enhanced conversions, against standard conversion imports.',
    },
    {
      figure: '26%',
      text: 'more incremental ROAS on average for advertisers who connect offline and app data through Data Manager.',
    },
  ],
  source: 'Source: Google (vendor data), September 2026',
};

/**
 * Under the second question ("Does anybody trust these numbers?"). MMA, The
 * State of Marketing Analytics, April 2026 (103 senior marketers): 36% chose
 * "Data is trustworthy as presented". IAB/BWG, State of Data 2026, February
 * 2026 (n=430): 49% cite "Concerns about AI accuracy/transparency" as a
 * significant or critical concern in the next 1-2 years.
 */
export const TRUST_FIGURES: Evidence = {
  tiles: [
    {
      figure: '36%',
      text: 'of senior marketers say their marketing data is trustworthy as presented.',
    },
    {
      figure: '49%',
      text: 'of senior planning and analytics leads expect AI accuracy and transparency to be a significant or critical measurement concern within two years.',
    },
  ],
  source: 'Sources: MMA, April 2026; IAB, February 2026',
};

/**
 * Under the third question ("Who owns this data?"). Supermetrics, Marketing
 * Data Report 2026 (435 marketers, fieldwork October to December 2025): 52%
 * "place data strategy responsibility outside marketing". MMA, April 2026:
 * 20% say "Customer data is fully unified".
 */
export const OWNERSHIP_FIGURES: Evidence = {
  tiles: [
    {
      figure: '52%',
      text: 'of marketers say responsibility for data strategy sits outside marketing.',
    },
    {
      figure: '20%',
      text: 'of senior marketers say their customer data is fully unified.',
    },
  ],
  source: 'Sources: Supermetrics (vendor survey), 2026; MMA, April 2026',
};
