/**
 * Origin allowlist matching (dev trial, 2026-09-02).
 *
 * The gate was an exact-match list of the two production origins, so
 * localhost and every Vercel preview deployment got 403 and the page
 * showed the capacity line. An entry may carry ONE `*` in its host,
 * matched as prefix + suffix; scheme and port must match exactly.
 */
import { isOriginAllowed, loadConfig } from './config';

const allowed = [
  'https://iampatterson.com',
  'https://iampatterson-com.vercel.app',
  'https://iampatterson-com-*.vercel.app',
  'http://localhost:3000',
];

describe('isOriginAllowed', () => {
  it('matches exact entries', () => {
    expect(isOriginAllowed('https://iampatterson.com', allowed)).toBe(true);
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(true);
  });

  it('matches a single-wildcard host as prefix + suffix (Vercel preview deployments)', () => {
    expect(isOriginAllowed('https://iampatterson-com-git-feat-claudish-ian.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://iampatterson-com-abc123-ian.vercel.app', allowed)).toBe(true);
  });

  it('refuses everything else: other hosts, other schemes, other ports, empty', () => {
    expect(isOriginAllowed('https://evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('https://iampatterson-com-x.vercel.app.evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('http://iampatterson.com', allowed)).toBe(false);
    expect(isOriginAllowed('http://localhost:3001', allowed)).toBe(false);
    expect(isOriginAllowed('', allowed)).toBe(false);
  });

  it('a wildcard entry never matches when the origin lacks the literal suffix', () => {
    expect(isOriginAllowed('https://iampatterson-com-', allowed)).toBe(false);
  });
});

describe('default allowlist', () => {
  it('includes production, the Vercel preview pattern, and localhost dev', () => {
    const cfg = loadConfig({ MODEL_ID_CONFIRMED: '1' } as NodeJS.ProcessEnv);
    expect(cfg.allowedOrigins).toEqual(expect.arrayContaining(['https://iampatterson.com', 'https://iampatterson-com-*.vercel.app', 'http://localhost:3000']));
  });
});
