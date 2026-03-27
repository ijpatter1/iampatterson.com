// sGTM Custom Tag Template: Pub/Sub - Publish All Events
//
// Publishes every sGTM event to a Google Cloud Pub/Sub topic for the
// real-time SSE pipeline. Uses getGoogleAuth for automatic credential
// management (works with Stape GCP integration or Cloud Run default SA).
//
// Setup in sGTM:
//   1. Templates > New Tag Template
//   2. Paste this code in the Code tab
//   3. Add a text field "topicPath" (default: projects/iampatterson/topics/iampatterson-events)
//   4. Permissions tab:
//      - sendHttpRequest: allow https://pubsub.googleapis.com/*
//      - getCookieValues: allow _iap_sid
//      - Uses Google application default credentials: allow https://www.googleapis.com/auth/cloud-platform
//      - Reads event data: any
//   5. Save template, then create a tag using it with trigger "All GA4 Events"
//
// Sandboxed JS limitations:
//   - No Date, Math, or other browser/Node globals
//   - No isConsentGranted (web container only) — read consent from event data
//   - getTimestampMillis() returns epoch ms as a number
//   - toBase64() and JSON.stringify() are available via require()

var sendHttpRequest = require('sendHttpRequest');
var getGoogleAuth = require('getGoogleAuth');
var JSON = require('JSON');
var getTimestampMillis = require('getTimestampMillis');
var generateRandom = require('generateRandom');
var getAllEventData = require('getAllEventData');
var getCookieValues = require('getCookieValues');
var toBase64 = require('toBase64');
var makeString = require('makeString');
var getEventData = require('getEventData');

var auth = getGoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

var eventData = getAllEventData();
// GA4's sGTM client maps session_id to ga_session_id in the common event data model.
// Falls back to _iap_sid cookie (only works when sGTM is on the same root domain).
var sessionId =
  eventData.ga_session_id || eventData.session_id || getCookieValues('_iap_sid')[0] || '';
var receivedAt = makeString(getTimestampMillis());
var pipelineId = 'pipe-' + receivedAt + '-' + generateRandom(1, 999999);

// In sGTM, consent state arrives via the event data from the web container.
// x-ga-cs-* fields are set by the GA4 client when it parses incoming hits.
// We also check explicit consent fields that Cookiebot may set.
var analyticsGranted =
  eventData['x-ga-cs-analytics_storage'] === 'granted' || eventData.consent_analytics === 'granted';
var adGranted = eventData['x-ga-cs-ad_storage'] === 'granted';
var adUserData = eventData['x-ga-cs-ad_user_data'] === 'granted';
var adPersonalization = eventData['x-ga-cs-ad_personalization'] === 'granted';
var functionalityGranted =
  eventData['x-ga-cs-functionality_storage'] === 'granted' ||
  eventData.consent_preferences === 'granted';

var consentStatus = function (granted) {
  return granted ? 'granted' : 'denied';
};
var routingStatus = function (granted) {
  return granted ? 'sent' : 'blocked_consent';
};

var payload = {
  pipeline_id: pipelineId,
  received_at: receivedAt,
  session_id: sessionId,
  event_name: eventData.event_name || '',
  timestamp: eventData.timestamp || '',
  page_path: eventData.page_path || eventData.page_location_path || '',
  page_title: eventData.page_title || '',
  page_location: eventData.page_location || '',
  parameters: {
    page_referrer: eventData.page_referrer || '',
    depth_percentage: eventData.depth_percentage || '',
    depth_pixels: eventData.depth_pixels || '',
    link_text: eventData.link_text || '',
    link_url: eventData.link_url || '',
    cta_text: eventData.cta_text || '',
    cta_location: eventData.cta_location || '',
    form_name: eventData.form_name || '',
    field_name: eventData.field_name || '',
    form_success: eventData.form_success || '',
    consent_analytics: eventData.consent_analytics || '',
    consent_marketing: eventData.consent_marketing || '',
    consent_preferences: eventData.consent_preferences || '',
  },
  consent: {
    analytics_storage: consentStatus(analyticsGranted),
    ad_storage: consentStatus(adGranted),
    ad_user_data: consentStatus(adUserData),
    ad_personalization: consentStatus(adPersonalization),
    functionality_storage: consentStatus(functionalityGranted),
  },
  routing: [
    { destination: 'ga4', status: routingStatus(analyticsGranted), timestamp: receivedAt },
    { destination: 'bigquery', status: routingStatus(analyticsGranted), timestamp: receivedAt },
    { destination: 'pubsub', status: 'sent', timestamp: receivedAt },
  ],
};

var requestBody = JSON.stringify({
  messages: [
    {
      data: toBase64(JSON.stringify(payload)),
    },
  ],
});

var topicPath = data.topicPath || 'projects/iampatterson/topics/iampatterson-events';
var url = 'https://pubsub.googleapis.com/v1/' + topicPath + ':publish';

sendHttpRequest(
  url,
  {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    authorization: auth,
  },
  requestBody,
).then(function (result) {
  if (result.statusCode >= 200 && result.statusCode < 300) {
    data.gtmOnSuccess();
  } else {
    data.gtmOnFailure();
  }
});
