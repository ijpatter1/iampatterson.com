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

// Only process events tagged with _iap marker from our data layer.
// This filters out GA4 automatic page_view hits and other non-custom events.
if (!eventData.iap_source) {
  data.gtmOnSuccess();
  return;
}

// GA4's sGTM client maps session_id to ga_session_id in the common event data model.
// Falls back to _iap_sid cookie (only works when sGTM is on the same root domain).
var sessionId =
  eventData.ga_session_id || eventData.session_id || getCookieValues('_iap_sid')[0] || '';
var receivedAt = makeString(getTimestampMillis());
var pipelineId = 'pipe-' + receivedAt + '-' + generateRandom(1, 999999);

// In sGTM, consent state arrives via two possible channels:
//   1. x-ga-cs-* fields set by the GA4 client from Consent Mode signals (string: 'granted'/'denied')
//   2. Custom event parameters from the data layer (boolean true/false or string 'true'/'granted')
// We check both, with x-ga-cs-* taking priority.
var isGranted = function (value) {
  return value === 'granted' || value === true || value === 'true';
};
var analyticsGranted =
  isGranted(eventData['x-ga-cs-analytics_storage']) || isGranted(eventData.consent_analytics);
var adGranted =
  isGranted(eventData['x-ga-cs-ad_storage']) || isGranted(eventData.consent_marketing);
var adUserData =
  isGranted(eventData['x-ga-cs-ad_user_data']) || isGranted(eventData.consent_marketing);
var adPersonalization =
  isGranted(eventData['x-ga-cs-ad_personalization']) || isGranted(eventData.consent_marketing);
var functionalityGranted =
  isGranted(eventData['x-ga-cs-functionality_storage']) || isGranted(eventData.consent_preferences);

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
  parameters: (function () {
    var params = {};
    var keys = [
      'page_referrer',
      'depth_percentage',
      'depth_pixels',
      'link_text',
      'link_url',
      'cta_text',
      'cta_location',
      'form_name',
      'field_name',
      'form_success',
      'consent_analytics',
      'consent_marketing',
      'consent_preferences',
    ];
    for (var i = 0; i < keys.length; i++) {
      var val = eventData[keys[i]];
      if (val !== undefined && val !== null && val !== '') {
        params[keys[i]] = val;
      }
    }
    return params;
  })(),
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
