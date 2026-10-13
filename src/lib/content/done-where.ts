export interface DoneWhereCard {
  name: string;
  when: string;
  text: string;
}

export const DONE_WHERE = {
  eyebrow: "Where I've done it",
  cards: [
    {
      name: 'UP Entertainment',
      when: '2021 to 2024',
      text: 'Data and analytics engineering for a streaming subscription business spending six figures a week on paid media.',
    },
    {
      name: 'Allied Global Marketing',
      when: '2025',
      text: "VP of Data and Technology. Conversions APIs through server-side GTM for the agency's clients.",
    },
    {
      name: 'An ad tech startup',
      when: '2026',
      text: 'Order-to-platform conversion pipeline and customer matching.',
    },
    {
      name: 'Tuna Melts My Heart',
      when: 'Co-owner',
      text: 'A pet brand with more than 2 million followers and partnerships with Coca-Cola, Disney+ and Target. My production store.',
    },
  ] satisfies DoneWhereCard[],
  closing:
    "I make the technical decisions and I do the build. Your media buyer's numbers stay in the view; I add the ones you can verify. I also build the pipes the data runs through: store to CRM, billing to warehouse, platform migrations without losing history.",
} as const;
