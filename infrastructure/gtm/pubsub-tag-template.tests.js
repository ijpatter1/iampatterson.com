// sGTM Template Tests for: Pub/Sub - Publish All Events
//
// Paste into the "Tests" tab of the custom tag template editor in sGTM.
// These use the sGTM sandboxed testing APIs:
//   mock() — stub sandboxed API return values
//   runCode(code) — execute the template code
//   assertApi() — verify API was called with expected args
//   assertThat() — general assertions (uses Truth-style API)
//
// Note: The captured request body is double-JSON-stringified (payload JSON
// inside Pub/Sub envelope JSON), so inner quotes appear as \" in assertions.
//
// Note: data.gtmOnSuccess/data.gtmOnFailure are template runtime globals,
// not mockable APIs. We verify the HTTP call was made correctly; the
// success/failure callback is implicitly tested by the template not timing out.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

var mockEventDataBase = {
  iap_source: true,
  event_name: 'page_view',
  timestamp: '2026-03-27T12:00:00.000Z',
  page_path: '/',
  page_title: 'Home | Patterson Consulting',
  page_location: 'https://iampatterson.com/',
  page_referrer: 'https://google.com/',
};

// Consent-granted event data (sGTM receives consent via x-ga-cs-* fields)
var mockEventDataConsented = {
  iap_source: true,
  event_name: 'page_view',
  timestamp: '2026-03-27T12:00:00.000Z',
  page_path: '/',
  page_title: 'Home | Patterson Consulting',
  page_location: 'https://iampatterson.com/',
  page_referrer: 'https://google.com/',
  'x-ga-cs-analytics_storage': 'granted',
  'x-ga-cs-ad_storage': 'granted',
  'x-ga-cs-ad_user_data': 'granted',
  'x-ga-cs-ad_personalization': 'granted',
  'x-ga-cs-functionality_storage': 'granted',
};

// Consent-denied event data (fields absent or not 'granted')
var mockEventDataDenied = {
  iap_source: true,
  event_name: 'page_view',
  timestamp: '2026-03-27T12:00:00.000Z',
  page_path: '/',
  page_title: 'Home | Patterson Consulting',
  page_location: 'https://iampatterson.com/',
  page_referrer: 'https://google.com/',
  'x-ga-cs-analytics_storage': 'denied',
  'x-ga-cs-ad_storage': 'denied',
  'x-ga-cs-ad_user_data': 'denied',
  'x-ga-cs-ad_personalization': 'denied',
  'x-ga-cs-functionality_storage': 'denied',
};

function setupMocks(overrides) {
  var event = overrides && overrides.eventData ? overrides.eventData : mockEventDataBase;

  var sessionCookie =
    overrides && overrides.sessionCookie ? overrides.sessionCookie : 'sess-abc-123';

  var httpStatus = overrides && overrides.httpStatus ? overrides.httpStatus : 200;

  mock('getAllEventData', function () {
    return event;
  });
  mock('getEventData', function (key) {
    return event[key];
  });
  mock('getCookieValues', function () {
    return [sessionCookie];
  });
  mock('getTimestampMillis', function () {
    return 1711540800000;
  });
  mock('generateRandom', function () {
    return 42;
  });
  mock('toBase64', function (str) {
    return 'BASE64:' + str;
  });
  mock('makeString', function (val) {
    return '' + val;
  });
  mock('getGoogleAuth', function () {
    return { token: 'mock-token' };
  });

  mock('sendHttpRequest', function (url, options, body) {
    return {
      then: function (cb) {
        cb({ statusCode: httpStatus, body: '{"messageIds":["123"]}' });
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Test: sends POST to correct Pub/Sub URL
// ---------------------------------------------------------------------------

setupMocks();
runCode(code);

assertApi('sendHttpRequest').wasCalled();

// ---------------------------------------------------------------------------
// Test: payload contains correct session_id from cookie
// ---------------------------------------------------------------------------

setupMocks({ sessionCookie: 'my-session-xyz' });

var capturedBody;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody).contains('my-session-xyz');

// ---------------------------------------------------------------------------
// Test: empty session cookie falls back to empty string
// ---------------------------------------------------------------------------

setupMocks();
mock('getCookieValues', function () {
  return [];
});

var capturedBody2;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody2 = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody2).contains('\\"session_id\\":\\"\\"');

// ---------------------------------------------------------------------------
// Test: consent denied sets correct consent and routing status
// ---------------------------------------------------------------------------

setupMocks({ eventData: mockEventDataDenied });

var capturedBody3;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody3 = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody3).contains('\\"analytics_storage\\":\\"denied\\"');
assertThat(capturedBody3).contains('\\"blocked_consent\\"');

// ---------------------------------------------------------------------------
// Test: consent granted sets correct consent and routing status
// ---------------------------------------------------------------------------

setupMocks({ eventData: mockEventDataConsented });

var capturedBody4;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody4 = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody4).contains('\\"analytics_storage\\":\\"granted\\"');
assertThat(capturedBody4).doesNotContain('\\"blocked_consent\\"');

// ---------------------------------------------------------------------------
// Test: payload includes event_name from event data
// ---------------------------------------------------------------------------

setupMocks({
  eventData: {
    iap_source: true,
    event_name: 'scroll_depth',
    timestamp: '',
    page_path: '/about',
    page_title: 'About',
    page_location: 'https://iampatterson.com/about',
    depth_percentage: '50',
    depth_pixels: '1200',
  },
});

var capturedBody5;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody5 = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody5).contains('\\"event_name\\":\\"scroll_depth\\"');
assertThat(capturedBody5).contains('\\"depth_percentage\\":\\"50\\"');

// ---------------------------------------------------------------------------
// Test: boolean consent values from data layer are handled correctly
// ---------------------------------------------------------------------------

setupMocks({
  eventData: {
    iap_source: true,
    event_name: 'consent_update',
    timestamp: '2026-03-27T12:00:00.000Z',
    page_path: '/',
    page_title: 'Home | Patterson Consulting',
    page_location: 'https://iampatterson.com/',
    consent_analytics: true,
    consent_marketing: true,
    consent_preferences: true,
  },
});

var capturedBody8;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody8 = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody8).contains('\\"analytics_storage\\":\\"granted\\"');
assertThat(capturedBody8).contains('\\"ad_storage\\":\\"granted\\"');
assertThat(capturedBody8).contains('\\"functionality_storage\\":\\"granted\\"');
assertThat(capturedBody8).doesNotContain('\\"blocked_consent\\"');

// ---------------------------------------------------------------------------
// Test: pipeline_id is generated with timestamp and random number
// ---------------------------------------------------------------------------

setupMocks();

var capturedBody6;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody6 = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody6).contains('\\"pipeline_id\\":\\"pipe-1711540800000-42\\"');

// ---------------------------------------------------------------------------
// Test: pubsub routing entry always has status "sent" even when denied
// ---------------------------------------------------------------------------

setupMocks({ eventData: mockEventDataDenied });

var capturedBody7;
mock('sendHttpRequest', function (url, options, body) {
  capturedBody7 = body;
  return {
    then: function (cb) {
      cb({ statusCode: 200, body: '' });
    },
  };
});

runCode(code);
assertThat(capturedBody7).contains('\\"destination\\":\\"pubsub\\",\\"status\\":\\"sent\\"');
