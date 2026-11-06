import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// Production smoke test against the deployed site and the real Supabase project.
// Credentials come from the environment or a git-ignored .env.test.local:
//   PROD_URL=https://<project>.pages.dev
//   LIVE_EMAIL=...
//   LIVE_PASSWORD=...
if (existsSync('.env.test.local')) process.loadEnvFile('.env.test.local')

export default defineConfig({
  testDir: 'tests/prod',
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
  use: { baseURL: process.env.PROD_URL, channel: 'chrome', trace: 'retain-on-failure' },
})
