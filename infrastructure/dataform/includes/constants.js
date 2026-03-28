/**
 * Shared constants for Dataform models.
 */

const PROJECT = 'iampatterson';
const RAW_DATASET = 'iampatterson_raw';
const STAGING_DATASET = 'iampatterson_staging';
const MARTS_DATASET = 'iampatterson_marts';

// Business model route prefixes used to scope events
const ECOMMERCE_PREFIX = '/demo/ecommerce';
const SUBSCRIPTION_PREFIX = '/demo/subscription';
const LEADGEN_PREFIX = '/demo/leadgen';

// Event names by business model
const ECOMMERCE_EVENTS = ['product_view', 'add_to_cart', 'begin_checkout', 'purchase'];

const SUBSCRIPTION_EVENTS = [
  'plan_select',
  'trial_signup',
  'subscription_renewal',
  'subscription_churn',
];

const LEADGEN_EVENTS = ['form_start', 'form_field_focus', 'form_complete', 'lead_qualify'];

const SHARED_EVENTS = ['page_view', 'scroll_depth', 'click_nav', 'click_cta', 'consent_update'];

module.exports = {
  PROJECT,
  RAW_DATASET,
  STAGING_DATASET,
  MARTS_DATASET,
  ECOMMERCE_PREFIX,
  SUBSCRIPTION_PREFIX,
  LEADGEN_PREFIX,
  ECOMMERCE_EVENTS,
  SUBSCRIPTION_EVENTS,
  LEADGEN_EVENTS,
  SHARED_EVENTS,
};
