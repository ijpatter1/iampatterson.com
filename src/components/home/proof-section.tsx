const PROOF = [
  {
    tag: 'Audience',
    metric: '2.5',
    unit: 'M',
    context:
      'Followers on the Tuna Melts My Heart brand — a Chiweenie with an overbite. Serious infrastructure, applied to a dog.',
  },
  {
    tag: 'Revenue proof',
    metric: '$45',
    unit: 'K',
    context:
      'Produced by an AI-generated calendar program, measured end-to-end on the same pipeline running under this site.',
  },
  {
    tag: 'Live events',
    metric: '24/',
    unit: '7',
    context:
      'Every visitor to this site generates real events flowing through the full stack. Open the overlay to watch yours.',
  },
];

export function ProofSection() {
  return (
    <section
      data-testid="proof-section"
      className="border-t border-rule-soft bg-paper py-20 md:py-28"
    >
      <div className="mx-auto max-w-content px-5 md:px-10">
        <span className="block font-mono text-[10px] uppercase tracking-widest text-ink-3">
          Evidence · What the infrastructure has done
        </span>
        <h2
          className="mt-6 font-display font-normal text-ink"
          style={{
            fontSize: 'clamp(40px, 7vw, 96px)',
            lineHeight: '0.95',
            letterSpacing: '-0.02em',
          }}
        >
          The stack running
          <br />
          under this page is the
          <br />
          <em className="text-accent-current">same one</em> I deploy.
        </h2>
        <p className="mt-6 max-w-[48ch] text-base leading-[1.6] text-ink-2">
          A MarTech consulting practice that also runs a 2.5M-follower pet brand and produced
          AI-generated calendars that made $45k. The measurement infrastructure isn&apos;t a case
          study — it&apos;s the proof.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
          {PROOF.map((p) => (
            <div
              key={p.tag}
              data-testid={`proof-card-${p.tag.toLowerCase().replace(/\s/g, '-')}`}
              className="flex flex-col gap-4 border border-rule-soft bg-paper p-6 transition-all hover:border-ink"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                {p.tag}
              </span>
              <span
                className="font-display font-normal text-ink"
                style={{
                  fontSize: 'clamp(56px, 8vw, 104px)',
                  lineHeight: '0.9',
                  letterSpacing: '-0.025em',
                }}
              >
                {p.metric}
                <span className="text-accent-current">{p.unit}</span>
              </span>
              <span className="text-sm leading-[1.6] text-ink-2">{p.context}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
