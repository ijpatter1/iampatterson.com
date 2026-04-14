/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { CampaignTaxonomyUnderside } from '@/components/overlay/ecommerce/campaign-taxonomy-underside';
import { StagingLayerUnderside } from '@/components/overlay/ecommerce/staging-layer-underside';
import { DataQualityUnderside } from '@/components/overlay/ecommerce/data-quality-underside';
import { WarehouseWriteUnderside } from '@/components/overlay/ecommerce/warehouse-write-underside';
import { Tier3Underside } from '@/components/overlay/ecommerce/tier3-underside';
import { EcommerceUnderside } from '@/components/overlay/ecommerce/ecommerce-underside';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { createPipelineEvent } from '@/lib/events/pipeline-schema';

function makeEvent(overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return createPipelineEvent({
    session_id: 'test-123',
    event_name: 'page_view',
    timestamp: '2026-04-04T12:00:00.000Z',
    page_path: '/demo/ecommerce',
    page_title: 'The Tuna Shop',
    page_location:
      'https://iampatterson.com/demo/ecommerce?utm_source=meta&utm_medium=paid&utm_campaign=prospecting_lal_tuna_q1',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functionality_storage: 'granted',
    },
    routing: [
      { destination: 'ga4', status: 'sent', timestamp: '2026-04-04T12:00:00.000Z' },
      { destination: 'bigquery', status: 'sent', timestamp: '2026-04-04T12:00:00.000Z' },
    ],
    ...overrides,
  });
}

describe('CampaignTaxonomyUnderside', () => {
  it('renders the campaign taxonomy heading', () => {
    render(<CampaignTaxonomyUnderside events={[makeEvent()]} />);
    expect(screen.getByRole('heading', { name: /campaign taxonomy/i })).toBeInTheDocument();
  });

  it('shows raw UTM parameter labels', () => {
    render(<CampaignTaxonomyUnderside events={[makeEvent()]} />);
    expect(screen.getByText('utm_source')).toBeInTheDocument();
    expect(screen.getByText('utm_campaign')).toBeInTheDocument();
  });

  it('shows classified taxonomy output fields', () => {
    render(<CampaignTaxonomyUnderside events={[makeEvent()]} />);
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Campaign Type')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
  });

  it('handles direct traffic (no UTMs) gracefully', () => {
    const event = makeEvent({
      page_location: 'https://iampatterson.com/demo/ecommerce',
    });
    render(<CampaignTaxonomyUnderside events={[event]} />);
    // "Direct" appears in multiple classified fields — just check it renders
    expect(screen.getAllByText('Direct').length).toBeGreaterThan(0);
  });

  it('shows the AI.CLASSIFY reference', () => {
    render(<CampaignTaxonomyUnderside events={[makeEvent()]} />);
    expect(screen.getAllByText(/AI\.CLASSIFY/).length).toBeGreaterThan(0);
  });
});

describe('StagingLayerUnderside', () => {
  it('renders the staging layer heading', () => {
    render(<StagingLayerUnderside events={[makeEvent({ event_name: 'product_view' })]} />);
    expect(screen.getByRole('heading', { name: /staging layer/i })).toBeInTheDocument();
  });

  it('shows the raw event and stg_events sections', () => {
    render(<StagingLayerUnderside events={[makeEvent({ event_name: 'product_view' })]} />);
    expect(screen.getByRole('heading', { name: /raw event/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /stg_events output/i })).toBeInTheDocument();
  });
});

describe('DataQualityUnderside', () => {
  it('renders the data quality heading', () => {
    render(<DataQualityUnderside events={[makeEvent({ event_name: 'add_to_cart' })]} />);
    expect(screen.getByRole('heading', { name: /data quality/i })).toBeInTheDocument();
  });

  it('shows assertion checklist items', () => {
    render(<DataQualityUnderside events={[makeEvent({ event_name: 'add_to_cart' })]} />);
    expect(screen.getByText('Schema Validation')).toBeInTheDocument();
    expect(screen.getByText('Null Checks')).toBeInTheDocument();
    expect(screen.getByText('Volume Anomaly Detection')).toBeInTheDocument();
  });
});

describe('WarehouseWriteUnderside', () => {
  it('renders the warehouse write heading', () => {
    render(<WarehouseWriteUnderside events={[makeEvent({ event_name: 'begin_checkout' })]} />);
    expect(screen.getByRole('heading', { name: /warehouse write/i })).toBeInTheDocument();
  });

  it('shows the BigQuery table reference', () => {
    render(<WarehouseWriteUnderside events={[makeEvent({ event_name: 'begin_checkout' })]} />);
    expect(screen.getAllByText(/events_raw/).length).toBeGreaterThan(0);
  });
});

describe('Tier3Underside', () => {
  it('renders the Tier 3 heading', () => {
    render(<Tier3Underside events={[makeEvent({ event_name: 'purchase' })]} />);
    expect(screen.getByRole('heading', { name: /business intelligence/i })).toBeInTheDocument();
  });

  it('shows funnel metrics', () => {
    render(<Tier3Underside events={[makeEvent({ event_name: 'purchase' })]} />);
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('Average Order Value')).toBeInTheDocument();
  });

  it('shows an actionable insight section', () => {
    render(<Tier3Underside events={[makeEvent({ event_name: 'purchase' })]} />);
    expect(screen.getByRole('heading', { name: /actionable insight/i })).toBeInTheDocument();
  });
});

describe('EcommerceUnderside', () => {
  it('renders CampaignTaxonomyUnderside on /demo/ecommerce', () => {
    render(<EcommerceUnderside pathname="/demo/ecommerce" events={[makeEvent()]} />);
    expect(screen.getByRole('heading', { name: /campaign taxonomy/i })).toBeInTheDocument();
  });

  it('renders StagingLayerUnderside on product detail pages', () => {
    render(
      <EcommerceUnderside
        pathname="/demo/ecommerce/tuna-classic"
        events={[makeEvent({ event_name: 'product_view' })]}
      />,
    );
    expect(screen.getByRole('heading', { name: /staging layer/i })).toBeInTheDocument();
  });

  it('renders DataQualityUnderside on /demo/ecommerce/cart', () => {
    render(
      <EcommerceUnderside
        pathname="/demo/ecommerce/cart"
        events={[makeEvent({ event_name: 'add_to_cart' })]}
      />,
    );
    expect(screen.getByRole('heading', { name: /data quality/i })).toBeInTheDocument();
  });

  it('renders WarehouseWriteUnderside on /demo/ecommerce/checkout', () => {
    render(
      <EcommerceUnderside
        pathname="/demo/ecommerce/checkout"
        events={[makeEvent({ event_name: 'begin_checkout' })]}
      />,
    );
    expect(screen.getByRole('heading', { name: /warehouse write/i })).toBeInTheDocument();
  });

  it('renders Tier3Underside on /demo/ecommerce/confirmation', () => {
    render(
      <EcommerceUnderside
        pathname="/demo/ecommerce/confirmation"
        events={[makeEvent({ event_name: 'purchase' })]}
      />,
    );
    expect(screen.getByRole('heading', { name: /business intelligence/i })).toBeInTheDocument();
  });
});
