const offerings = [
  {
    title: 'Sponsored Content',
    description:
      'Authentic Tuna-branded content featuring your product, distributed across our social channels.',
  },
  {
    title: 'Product Collaboration',
    description:
      'Co-branded merchandise designed, produced, and sold through our e-commerce platform.',
  },
  {
    title: 'Event Sponsorship',
    description: 'Presence at our live events, including the annual Holiday Pawty.',
  },
  {
    title: 'Licensing',
    description: 'License the Tuna brand and imagery for your own products and campaigns.',
  },
];

export function LeadgenLanding() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        Partner with Tuna Melts My Heart
      </h2>
      <p className="mt-2 text-lg text-neutral-600">
        2.5 million followers. 5,000 calendars sold. Real engagement, real conversions.
      </p>
      <p className="mt-4 text-base leading-relaxed text-neutral-600">
        Tuna Melts My Heart isn&apos;t just a social media account — it&apos;s a consumer brand with
        a proven audience and a track record of turning followers into buyers. We work with brands
        that want to reach an engaged, passionate community of pet lovers and lifestyle consumers.
      </p>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Partnership Highlights
        </h3>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li>2.5M Instagram followers with above-average engagement rates</li>
          <li>5,000+ units of AI-generated calendars sold annually</li>
          <li>Proven conversion from social content to e-commerce purchases</li>
          <li>
            Flexible formats: sponsored content, product collaborations, event sponsorships,
            licensing
          </li>
          <li>Full creative production capability including AI-generated custom imagery</li>
        </ul>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {offerings.map(({ title, description }) => (
          <div key={title} className="rounded-lg border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900">{title}</h4>
            <p className="mt-1 text-sm text-neutral-600">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
