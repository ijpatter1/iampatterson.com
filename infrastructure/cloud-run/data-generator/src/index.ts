/**
 * Background Data Generator — public API.
 *
 * Generates synthetic events for three demo business models
 * (e-commerce, subscription, lead gen) and sends them to sGTM.
 */

export type {
  BusinessModel,
  GeneratorConfig,
  EcommerceProfile,
  SubscriptionProfile,
  LeadGenProfile,
  SyntheticEvent,
  SyntheticBaseEvent,
  AdPlatformRecord,
  SeasonalityConfig,
  ChannelConfig,
  CampaignConfig,
  Product,
  SubscriptionPlan,
} from './types';

export {
  createConfig,
  createEcommerceConfig,
  createSubscriptionConfig,
  createLeadgenConfig,
} from './profiles';

export { validateConfig } from './validation';
export type { ValidationResult, ValidationError } from './validation';

export { SeededRandom } from './random';

export { generateBackfill, generateDay, generateDateRange, streamingBackfill } from './generator';
export type { GenerationResult, GenerationStats, StreamingBackfillResult } from './generator';

export { sendEvents, buildCollectParams } from './transport';
export type { TransportConfig, SendResult } from './transport';

export { generateEcommerceSession } from './engines/ecommerce';
export { generateSubscriptionSession, generateSubscriptionLifecycle } from './engines/subscription';
export { generateLeadgenSession } from './engines/leadgen';
