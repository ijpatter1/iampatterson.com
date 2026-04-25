import { defineConfig, devices } from '@playwright/test';

// Phase 10d D1 mobile-matrix viewports. Each project carries explicit
// metadata (`mobileLabel`, `mobileChromeBoost`) read by the matrix spec
// to compute the Safari-chrome-aware fold line. The `iPhone SE`-shaped
// viewport gets a 132px chrome budget (Safari URL bar + bottom toolbar
// plus a small safety margin = 132px against the 667px nominal height,
// leaving ~535px usable — the exact number called out in 9E F8 Product
// Minor #5). Other devices use Playwright's built-in chrome-inclusive
// viewport so the fold math stays honest without a per-device tweak.
const mobileMatrixProjects = [
  {
    name: 'matrix-iphone-se',
    use: {
      ...devices['iPhone SE'],
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    },
    metadata: { mobileLabel: 'iPhone SE (375×667)', mobileChromeBoost: 132 },
  },
  {
    name: 'matrix-iphone-13',
    use: { ...devices['iPhone 13'] },
    metadata: { mobileLabel: 'iPhone 13 (390×844)', mobileChromeBoost: 0 },
  },
  {
    name: 'matrix-pixel-5',
    use: { ...devices['Pixel 5'] },
    metadata: { mobileLabel: 'Pixel 5 (393×851)', mobileChromeBoost: 0 },
  },
  {
    name: 'matrix-ipad-mini-portrait',
    use: { ...devices['iPad Mini'] },
    metadata: { mobileLabel: 'iPad Mini portrait (768×1024)', mobileChromeBoost: 0 },
  },
  {
    name: 'matrix-ipad-mini-landscape',
    use: { ...devices['iPad Mini landscape'] },
    metadata: { mobileLabel: 'iPad Mini landscape (1024×768)', mobileChromeBoost: 0 },
  },
];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
    ...mobileMatrixProjects,
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
