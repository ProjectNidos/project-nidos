import { defineConfig, devices } from '@playwright/test';

const PORT = 4100;

// Runs against the production build (`npm run build` first). No database is
// needed: the public site falls back to its bundled texts.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    // Locally: the installed Google Chrome. CI installs Playwright's own Chromium.
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'chrome' } },
  ],
  webServer: {
    command: 'npm start',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      SITE_URL: `http://127.0.0.1:${PORT}`,
      SUPABASE_URL: 'http://127.0.0.1:9',
      SUPABASE_PUBLISHABLE_KEY: 'e2e',
      SUPABASE_SECRET_KEY: 'e2e',
    },
  },
});
