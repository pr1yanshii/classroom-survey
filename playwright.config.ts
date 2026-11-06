import { defineConfig, devices } from '@playwright/test'

const FAKE = 'http://127.0.0.1:54329'
const APP = 'http://127.0.0.1:4173'

// E2E tests run the production build against a local Supabase stand-in
// (tests/e2e/fake-supabase.ts). Your real Supabase project is never touched.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: APP,
    trace: 'retain-on-failure',
  },
  projects: [
    // Installed Google Chrome (Chromium engine)
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    // Firefox (Gecko engine). One-time setup: `npx playwright install firefox`.
    // WebKit is not used: Playwright's WebKit build for macOS 14 is incompatible with this version.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command: 'node tests/e2e/fake-supabase.ts',
      url: `${FAKE}/auth/v1/user`,
      reuseExistingServer: false,
    },
    {
      command:
        'vite build --outDir dist-e2e --emptyOutDir && vite preview --outDir dist-e2e --port 4173 --strictPort --host 127.0.0.1',
      url: APP,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_SUPABASE_URL: FAKE, VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
    },
  ],
})
