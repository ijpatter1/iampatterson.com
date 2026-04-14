import type { PipelineEvent } from '@/lib/events/pipeline-schema';

import { CampaignTaxonomyUnderside } from './campaign-taxonomy-underside';
import { DataQualityUnderside } from './data-quality-underside';
import { StagingLayerUnderside } from './staging-layer-underside';
import { Tier3Underside } from './tier3-underside';
import { WarehouseWriteUnderside } from './warehouse-write-underside';

interface EcommerceUndersideProps {
  pathname: string;
  events: PipelineEvent[];
}

/**
 * Routes to the correct underside component based on the e-commerce funnel page.
 *
 * /demo/ecommerce          → Campaign Taxonomy
 * /demo/ecommerce/[id]     → Staging Layer
 * /demo/ecommerce/cart      → Data Quality Framework
 * /demo/ecommerce/checkout  → Warehouse Write
 * /demo/ecommerce/confirmation → Tier 3 (BI)
 */
export function EcommerceUnderside({ pathname, events }: EcommerceUndersideProps) {
  if (pathname === '/demo/ecommerce') {
    return <CampaignTaxonomyUnderside events={events} />;
  }
  if (pathname === '/demo/ecommerce/cart') {
    return <DataQualityUnderside events={events} />;
  }
  if (pathname === '/demo/ecommerce/checkout') {
    return <WarehouseWriteUnderside events={events} />;
  }
  if (pathname === '/demo/ecommerce/confirmation') {
    return <Tier3Underside events={events} />;
  }
  // Product detail pages: /demo/ecommerce/[productId]
  if (pathname.startsWith('/demo/ecommerce/')) {
    return <StagingLayerUnderside events={events} />;
  }
  return <CampaignTaxonomyUnderside events={events} />;
}
