/**
 * Validation for GeneratorConfig objects.
 *
 * Catches misconfiguration early — distribution shares that don't sum to ~1,
 * negative rates, missing required fields, etc.
 */

import type {
  BusinessModel,
  ChannelConfig,
  EcommerceProfile,
  GeneratorConfig,
  LeadGenProfile,
  SeasonalityConfig,
  SubscriptionProfile,
} from './types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const BUSINESS_MODELS: BusinessModel[] = ['ecommerce', 'subscription', 'leadgen'];

function sumClose(values: number[], target: number, tolerance: number): boolean {
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.abs(sum - target) <= tolerance;
}

function validateSeasonality(seasonality: SeasonalityConfig, errors: ValidationError[]): void {
  if (seasonality.monthly.length !== 12) {
    errors.push({ field: 'seasonality.monthly', message: 'Must have exactly 12 monthly multipliers' });
  }
  if (seasonality.dayOfWeek.length !== 7) {
    errors.push({ field: 'seasonality.dayOfWeek', message: 'Must have exactly 7 day-of-week multipliers' });
  }
  if (seasonality.hourOfDay.length !== 24) {
    errors.push({ field: 'seasonality.hourOfDay', message: 'Must have exactly 24 hour-of-day multipliers' });
  }
  for (const arr of [seasonality.monthly, seasonality.dayOfWeek, seasonality.hourOfDay]) {
    if (arr.some((v) => v < 0)) {
      errors.push({ field: 'seasonality', message: 'Multipliers must be non-negative' });
      break;
    }
  }
}

function validateChannels(channels: ChannelConfig[], errors: ValidationError[]): void {
  if (channels.length === 0) {
    errors.push({ field: 'channels', message: 'At least one channel is required' });
    return;
  }

  const shares = channels.map((c) => c.trafficShare);
  if (!sumClose(shares, 1.0, 0.05)) {
    errors.push({
      field: 'channels.trafficShare',
      message: `Traffic shares must sum to ~1.0 (got ${shares.reduce((a, b) => a + b, 0).toFixed(3)})`,
    });
  }

  for (const ch of channels) {
    if (ch.trafficShare < 0 || ch.trafficShare > 1) {
      errors.push({ field: `channels.${ch.platform}.trafficShare`, message: 'Must be between 0 and 1' });
    }
    for (const camp of ch.campaigns) {
      if (camp.utmVariants.length === 0) {
        errors.push({ field: `channels.${ch.platform}.campaigns.${camp.name}`, message: 'Must have at least one UTM variant' });
      }
      if (camp.monthlySpend < 0) {
        errors.push({ field: `channels.${ch.platform}.campaigns.${camp.name}.monthlySpend`, message: 'Must be non-negative' });
      }
    }
  }
}

function validateEcommerceProfile(profile: EcommerceProfile, errors: ValidationError[]): void {
  if (profile.products.length === 0) {
    errors.push({ field: 'profile.products', message: 'At least one product is required' });
  }
  for (const product of profile.products) {
    if (product.price <= 0) {
      errors.push({ field: `profile.products.${product.id}.price`, message: 'Must be positive' });
    }
    if (product.weight < 0) {
      errors.push({ field: `profile.products.${product.id}.weight`, message: 'Must be non-negative' });
    }
  }
  const { viewToCart, cartToCheckout, checkoutToPurchase } = profile.funnelRates;
  for (const [name, rate] of Object.entries({ viewToCart, cartToCheckout, checkoutToPurchase })) {
    if (rate < 0 || rate > 1) {
      errors.push({ field: `profile.funnelRates.${name}`, message: 'Must be between 0 and 1' });
    }
  }
  if (profile.avgItemsPerOrder < 1) {
    errors.push({ field: 'profile.avgItemsPerOrder', message: 'Must be at least 1' });
  }
}

function validateSubscriptionProfile(profile: SubscriptionProfile, errors: ValidationError[]): void {
  if (profile.plans.length === 0) {
    errors.push({ field: 'profile.plans', message: 'At least one plan is required' });
  }
  const planShares = profile.plans.map((p) => p.signupShare);
  if (!sumClose(planShares, 1.0, 0.05)) {
    errors.push({
      field: 'profile.plans.signupShare',
      message: `Plan signup shares must sum to ~1.0 (got ${planShares.reduce((a, b) => a + b, 0).toFixed(3)})`,
    });
  }
  if (profile.trialConversionRate < 0 || profile.trialConversionRate > 1) {
    errors.push({ field: 'profile.trialConversionRate', message: 'Must be between 0 and 1' });
  }
  if (profile.churnCurve.length === 0) {
    errors.push({ field: 'profile.churnCurve', message: 'Must have at least one churn rate' });
  }
  if (profile.churnCurve.some((r) => r < 0 || r > 1)) {
    errors.push({ field: 'profile.churnCurve', message: 'All churn rates must be between 0 and 1' });
  }
}

function validateLeadgenProfile(profile: LeadGenProfile, errors: ValidationError[]): void {
  for (const [name, rate] of Object.entries({
    formStartRate: profile.formStartRate,
    formCompletionRate: profile.formCompletionRate,
    qualificationRate: profile.qualificationRate,
    meetingRate: profile.meetingRate,
  })) {
    if (rate < 0 || rate > 1) {
      errors.push({ field: `profile.${name}`, message: 'Must be between 0 and 1' });
    }
  }

  const partnershipValues = Object.values(profile.partnershipDistribution);
  if (!sumClose(partnershipValues, 1.0, 0.05)) {
    errors.push({
      field: 'profile.partnershipDistribution',
      message: `Must sum to ~1.0 (got ${partnershipValues.reduce((a, b) => a + b, 0).toFixed(3)})`,
    });
  }

  const budgetValues = Object.values(profile.budgetDistribution);
  if (!sumClose(budgetValues, 1.0, 0.05)) {
    errors.push({
      field: 'profile.budgetDistribution',
      message: `Must sum to ~1.0 (got ${budgetValues.reduce((a, b) => a + b, 0).toFixed(3)})`,
    });
  }
}

export function validateConfig(config: GeneratorConfig): ValidationResult {
  const errors: ValidationError[] = [];

  if (!BUSINESS_MODELS.includes(config.businessModel)) {
    errors.push({ field: 'businessModel', message: `Must be one of: ${BUSINESS_MODELS.join(', ')}` });
  }

  if (config.dailySessions <= 0) {
    errors.push({ field: 'dailySessions', message: 'Must be positive' });
  }

  if (config.backfillMonths < 0) {
    errors.push({ field: 'backfillMonths', message: 'Must be non-negative' });
  }

  if (config.monthlyGrowthRate < -1 || config.monthlyGrowthRate > 1) {
    errors.push({ field: 'monthlyGrowthRate', message: 'Must be between -1 and 1' });
  }

  validateSeasonality(config.seasonality, errors);
  validateChannels(config.channels, errors);

  // Validate that profile.model matches businessModel
  if (config.profile.model !== config.businessModel) {
    errors.push({
      field: 'profile.model',
      message: `Profile model '${config.profile.model}' does not match businessModel '${config.businessModel}'`,
    });
  }

  switch (config.profile.model) {
    case 'ecommerce':
      validateEcommerceProfile(config.profile, errors);
      break;
    case 'subscription':
      validateSubscriptionProfile(config.profile, errors);
      break;
    case 'leadgen':
      validateLeadgenProfile(config.profile, errors);
      break;
  }

  return { valid: errors.length === 0, errors };
}
