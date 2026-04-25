import { categorizeKey, STORAGE_CATEGORIES } from '@/lib/identity/storage-categories';

describe('storage-categories', () => {
  describe('STORAGE_CATEGORIES', () => {
    it('exports the five canonical category ids in display order', () => {
      expect(STORAGE_CATEGORIES.map((c) => c.id)).toEqual([
        'app-identity',
        'analytics',
        'consent',
        'third-party',
        'uncategorized',
      ]);
    });

    it('every category carries a label and a one-line description', () => {
      for (const cat of STORAGE_CATEGORIES) {
        expect(cat.label.length).toBeGreaterThan(0);
        expect(cat.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('categorizeKey — app-identity', () => {
    it('classifies _iap_aid as app-identity (D7 anonymous id cookie)', () => {
      expect(categorizeKey('_iap_aid', 'cookie')).toBe('app-identity');
    });

    it('classifies _iap_sid as app-identity (Phase 2 session cookie)', () => {
      expect(categorizeKey('_iap_sid', 'cookie')).toBe('app-identity');
    });

    it('classifies iampatterson.session_state as app-identity (sessionStorage blob)', () => {
      expect(categorizeKey('iampatterson.session_state', 'sessionStorage')).toBe('app-identity');
    });

    it('classifies iampatterson.overlay.booted as app-identity', () => {
      expect(categorizeKey('iampatterson.overlay.booted', 'sessionStorage')).toBe('app-identity');
    });

    it('classifies iampatterson.nav_hint.shown as app-identity', () => {
      expect(categorizeKey('iampatterson.nav_hint.shown', 'sessionStorage')).toBe('app-identity');
    });

    it('classifies any iampatterson.* prefix in localStorage as app-identity', () => {
      expect(categorizeKey('iampatterson.future_thing', 'localStorage')).toBe('app-identity');
    });
  });

  describe('categorizeKey — analytics', () => {
    it('classifies _ga as analytics (GA4 client id)', () => {
      expect(categorizeKey('_ga', 'cookie')).toBe('analytics');
    });

    it('classifies _ga_XXXXXXXX as analytics (GA4 measurement id session cookie)', () => {
      expect(categorizeKey('_ga_ABC123XYZ', 'cookie')).toBe('analytics');
    });

    it('classifies _gid as analytics (legacy GA cookie)', () => {
      expect(categorizeKey('_gid', 'cookie')).toBe('analytics');
    });

    it('classifies FPID as analytics (sGTM first-party id)', () => {
      expect(categorizeKey('FPID', 'cookie')).toBe('analytics');
    });

    it('classifies FPLC as analytics (sGTM first-party linker)', () => {
      expect(categorizeKey('FPLC', 'cookie')).toBe('analytics');
    });

    it('classifies _gcl_au as analytics (Google Ads conversion linker)', () => {
      expect(categorizeKey('_gcl_au', 'cookie')).toBe('analytics');
    });
  });

  describe('categorizeKey — consent (CMP)', () => {
    it('classifies CookieConsent as consent (Cookiebot main cookie)', () => {
      expect(categorizeKey('CookieConsent', 'cookie')).toBe('consent');
    });

    it('classifies CookieConsentBulkSetting-anything as consent (Cookiebot bulk policy)', () => {
      expect(categorizeKey('CookieConsentBulkSetting-abc123', 'cookie')).toBe('consent');
    });

    it('classifies CookieConsentBulkTicket as consent', () => {
      expect(categorizeKey('CookieConsentBulkTicket', 'cookie')).toBe('consent');
    });
  });

  describe('categorizeKey — third-party', () => {
    it('classifies _fbp as third-party (Meta Pixel browser id)', () => {
      expect(categorizeKey('_fbp', 'cookie')).toBe('third-party');
    });

    it('classifies _uetsid as third-party (Microsoft UET session)', () => {
      expect(categorizeKey('_uetsid', 'cookie')).toBe('third-party');
    });

    it('classifies _pin_unauth as third-party (Pinterest)', () => {
      expect(categorizeKey('_pin_unauth', 'cookie')).toBe('third-party');
    });
  });

  describe('categorizeKey — uncategorized', () => {
    it('classifies an unknown key as uncategorized', () => {
      expect(categorizeKey('some_random_key_we_dont_recognize', 'cookie')).toBe('uncategorized');
    });

    it('classifies an unknown localStorage key as uncategorized', () => {
      expect(categorizeKey('mystery.thing', 'localStorage')).toBe('uncategorized');
    });

    it('does not surprise-classify keys that just happen to contain "ga" inside a different name', () => {
      expect(categorizeKey('garage_door_open', 'cookie')).toBe('uncategorized');
    });

    it('does not surprise-classify keys that just happen to start with an underscore', () => {
      expect(categorizeKey('_internal_thing', 'cookie')).toBe('uncategorized');
    });
  });
});
