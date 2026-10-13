/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Certifications } from '@/components/home/certifications';
import { DoneWhere } from '@/components/home/done-where';
import { Problems } from '@/components/home/problems';
import { ReviewOffer } from '@/components/home/review-offer';
import { WhyItMatters } from '@/components/home/why-it-matters';
import { CERTIFICATIONS } from '@/lib/content/certifications';
import { DONE_WHERE } from '@/lib/content/done-where';
import { REVIEW_HREF } from '@/lib/content/hero';
import { NETWORKS, NETWORKS_LABEL } from '@/lib/content/networks';
import { PROBLEMS, PROBLEMS_EYEBROW, PROBLEM_LABELS } from '@/lib/content/problems';
import { REVIEW, REVIEW_PRICE } from '@/lib/content/review';
import { WHY_IT_MATTERS } from '@/lib/content/stats';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
});

// Each section renders its copy from a content module, verbatim. The tests
// assert the module's values, so a wording change is a one-file edit and a
// component that drops, retypes or reorders copy fails here.

describe('WhyItMatters', () => {
  it('renders the paragraph and both stat tiles', () => {
    render(<WhyItMatters />);
    expect(screen.getByText(WHY_IT_MATTERS.body)).toBeInTheDocument();
    for (const tile of WHY_IT_MATTERS.tiles) {
      expect(screen.getByText(tile.figure)).toBeInTheDocument();
      expect(screen.getByText(tile.text)).toBeInTheDocument();
    }
  });

  // The figures are Google's, so they are shown with their source.
  it('shows the source line with the figures', () => {
    render(<WhyItMatters />);
    expect(screen.getByText(WHY_IT_MATTERS.source)).toBeInTheDocument();
  });
});

describe('Problems', () => {
  it('renders the three problems in order, each as a heading with both paragraphs', () => {
    render(<Problems />);
    expect(screen.getByText(PROBLEMS_EYEBROW)).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(PROBLEMS.map((p) => p.title));
    for (const problem of PROBLEMS) {
      expect(screen.getByText(problem.whatIDo)).toBeInTheDocument();
      expect(screen.getByText(problem.doneBefore)).toBeInTheDocument();
    }
    expect(screen.getAllByText(PROBLEM_LABELS.whatIDo)).toHaveLength(3);
    expect(screen.getAllByText(PROBLEM_LABELS.doneBefore)).toHaveLength(3);
  });

  it('numbers the rows', () => {
    render(<Problems />);
    for (const problem of PROBLEMS) expect(screen.getByText(problem.num)).toBeInTheDocument();
  });
});

describe('ReviewOffer', () => {
  it('is the #review anchor the calls to action point at', () => {
    const { container } = render(<ReviewOffer />);
    expect(container.querySelector('section#review')).not.toBeNull();
  });

  it('renders the offer and its three columns', () => {
    render(<ReviewOffer />);
    expect(screen.getByRole('heading', { level: 2, name: REVIEW.title })).toBeInTheDocument();
    expect(screen.getByText(REVIEW.body)).toBeInTheDocument();
    for (const column of REVIEW.columns) {
      expect(screen.getByText(column.label)).toBeInTheDocument();
      expect(screen.getByText(column.text)).toBeInTheDocument();
    }
  });

  // One priced first step is the reason the page exists.
  it('shows the price from the single constant, and no placeholder', () => {
    render(<ReviewOffer />);
    expect(screen.getByText(`Fixed price · ${REVIEW_PRICE}`)).toBeInTheDocument();
    expect(screen.queryByText(/\[PRICE\]/)).not.toBeInTheDocument();
  });

  it('sends "Book the review" to the contact page with the review intent, and tracks it', async () => {
    render(<ReviewOffer />);
    const link = screen.getByRole('link', { name: REVIEW.cta });
    expect(link).toHaveAttribute('href', REVIEW_HREF);
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(trackClickCta).toHaveBeenCalledWith(REVIEW.cta, 'review');
  });
});

describe('DoneWhere', () => {
  it('renders the four cards with name, dates and text', () => {
    render(<DoneWhere />);
    const cards = screen.getAllByRole('heading', { level: 3 });
    expect(cards.map((h) => h.textContent)).toEqual(DONE_WHERE.cards.map((c) => c.name));
    for (const card of DONE_WHERE.cards) {
      expect(screen.getByText(card.when)).toBeInTheDocument();
      expect(screen.getByText(card.text)).toBeInTheDocument();
    }
  });

  it('lists the networks as plain text chips, with no image and no link', () => {
    render(<DoneWhere />);
    const row = screen.getByRole('list', { name: NETWORKS_LABEL });
    const chips = within(row).getAllByRole('listitem');
    expect(chips.map((c) => c.textContent)).toEqual([...NETWORKS]);
    expect(row.querySelector('img, svg, a')).toBeNull();
  });

  it('closes with the paragraph on who does the work', () => {
    render(<DoneWhere />);
    expect(screen.getByText(DONE_WHERE.closing)).toBeInTheDocument();
  });
});

describe('Certifications', () => {
  it('is the #certifications anchor and lists what is up next', () => {
    const { container } = render(<Certifications />);
    expect(container.querySelector('section#certifications')).not.toBeNull();
    expect(screen.getByText(CERTIFICATIONS.upNextLabel)).toBeInTheDocument();
    for (const cert of CERTIFICATIONS.upNext) {
      // Two certifications share an issuer, so the issuer is read from the
      // certification's own row.
      const row = screen.getByText(cert.name).closest('li');
      expect(row).toHaveTextContent(cert.issuer);
    }
  });

  // A "Completed" column, or an empty badge slot, would imply a credential
  // that does not exist.
  it('renders no Completed column and no badge while none is completed', () => {
    const { container } = render(<Certifications />);
    expect(CERTIFICATIONS.completed).toHaveLength(0);
    expect(screen.queryByText(CERTIFICATIONS.completedLabel)).not.toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders a completed certification, and a badge only when one was issued', () => {
    const { container } = render(
      <Certifications
        completed={[
          { name: 'With badge', issuer: 'Issuer A', year: '2027', badgeSrc: '/badges/a.png' },
          { name: 'Without badge', issuer: 'Issuer B', year: '2027' },
        ]}
      />,
    );
    expect(screen.getByText(CERTIFICATIONS.completedLabel)).toBeInTheDocument();
    expect(screen.getByText('With badge')).toBeInTheDocument();
    expect(screen.getByText('Without badge')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
