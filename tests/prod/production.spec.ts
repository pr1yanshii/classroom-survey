// Verifies the deployed app end to end: instructor + student workflows, QR, persistence,
// results. Creates one "[prod check]" survey and deletes it; re-activates whichever survey
// was active before. Run: npm run test:prod
import { expect, test, type Page } from '@playwright/test'
import jsQR from 'jsqr'
import { readFile } from 'node:fs/promises'
import { PNG } from 'pngjs'

const BASE = process.env.PROD_URL ?? ''
const EMAIL = process.env.LIVE_EMAIL ?? ''
const PASSWORD = process.env.LIVE_PASSWORD ?? ''
const TITLE = `[prod check] ${new Date().toISOString().slice(0, 16)}`
const PHONE = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }

test.skip(!BASE || !EMAIL || !PASSWORD, 'Set PROD_URL, LIVE_EMAIL, LIVE_PASSWORD')
test.describe.configure({ mode: 'serial' })

const card = (p: Page, title: string) =>
  p.locator('li').filter({ has: p.getByRole('heading', { name: title, exact: true }) })

test('production: full instructor and student workflow', async ({ browser }) => {
  // Static hosting + SPA routing + Supabase reachable from the public site
  const visitor = await browser.newPage()
  const res = await visitor.goto('/s/zzzzzz')
  expect(res?.status()).toBe(200)
  await expect(visitor.getByText('Survey not found.')).toBeVisible({ timeout: 15_000 })
  await visitor.goto('/dashboard')
  await expect(visitor).toHaveURL(/\/login$/)
  await visitor.getByLabel('Email').fill(EMAIL)
  await visitor.getByLabel('Password').fill(`${PASSWORD}-wrong`)
  await visitor.getByRole('button', { name: 'Log In' }).click()
  await expect(visitor.getByRole('alert')).toHaveText('Invalid email or password.')
  await visitor.close()

  // Instructor login
  const ictx = await browser.newContext()
  const p = await ictx.newPage()
  await p.goto('/login')
  await p.getByLabel('Email').fill(EMAIL)
  await p.getByLabel('Password').fill(PASSWORD)
  await p.getByRole('button', { name: 'Log In' }).click()
  await expect(p).toHaveURL(/\/dashboard$/)
  await expect(p.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await p.waitForLoadState('networkidle')
  const activeCard = p.locator('ul > li').filter({ has: p.getByText('Active', { exact: true }) })
  const previouslyActive =
    (await activeCard.count()) > 0
      ? await activeCard.first().getByRole('heading').innerText()
      : null

  let surveyId = ''
  try {
    // Create
    await p.getByRole('link', { name: 'New Survey' }).click()
    await p.getByLabel('Survey Title').fill(TITLE)
    await p.getByLabel('Question 1 text').fill('What is required for recursion?')
    await p.getByLabel('Question 1 choice 1').fill('A base case')
    await p.getByLabel('Question 1 choice 2').fill('A loop')
    await p.getByRole('button', { name: '+ Add Question' }).click()
    await p.locator('ol > li').nth(1).getByLabel('Type').selectOption('true_false')
    await p.getByLabel('Question 2 text').fill('Recursion needs a stopping condition.')
    await p.getByRole('button', { name: 'Save Draft' }).click()
    await expect(p.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
    surveyId = p.url().split('/')[4]

    // Persistence
    await p.reload()
    await expect(p.getByLabel('Survey Title')).toHaveValue(TITLE)
    await expect(p.getByLabel('Question 1 choice 2')).toHaveValue('A loop')

    // Activate + QR
    await p.getByRole('button', { name: 'Save & Activate' }).click()
    await expect(p).toHaveURL(/\/present$/)
    const urlText = await p.locator('p.font-mono').innerText()
    const studentUrl = `https://${urlText}`
    expect(studentUrl.startsWith(BASE.replace(/\/$/, ''))).toBe(true)
    const src = (await p.getByRole('img', { name: /QR code/ }).getAttribute('src'))!
    const png = PNG.sync.read(Buffer.from(src.split(',')[1], 'base64'))
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(studentUrl)

    // Two students on phones
    for (const [choice, tf] of [
      ['A base case', 'True'],
      ['A loop', 'False'],
    ]) {
      const sctx = await browser.newContext(PHONE)
      const s = await sctx.newPage()
      await s.goto(studentUrl)
      await s.getByLabel(choice).check()
      await s.getByLabel(tf).check()
      await s.getByRole('button', { name: 'Submit' }).click()
      await expect(s.getByRole('heading', { name: 'Thank you!' })).toBeVisible()
      if (choice === 'A base case') {
        await s.evaluate(() => {
          for (const k of Object.keys(localStorage))
            if (k.includes(':submitted:')) localStorage.removeItem(k)
        })
        await s.reload()
        await s.getByLabel('A loop').check()
        await s.getByLabel('True').check()
        await s.getByRole('button', { name: 'Submit' }).click()
        await expect(
          s.getByText('You have already submitted a response to this survey.'),
        ).toBeVisible()
      }
      await sctx.close()
    }

    // Live count + results
    await expect(p.getByText('Responses:')).toContainText('2', { timeout: 15_000 })
    await p.getByRole('link', { name: 'View Results' }).click()
    await expect(p.getByText('2 responses')).toBeVisible()
    const rows = (await p.locator('ol > li').nth(0).locator('tbody tr').allInnerTexts()).map((r) =>
      r.split('\t').map((c) => c.trim()),
    )
    expect(rows).toEqual([
      ['A base case', '1', '50.0%'],
      ['A loop', '1', '50.0%'],
    ])

    // CSV
    const download = p.waitForEvent('download')
    await p.getByRole('button', { name: 'Export CSV' }).click()
    const csv = await readFile((await (await download).path())!, 'utf8')
    expect(csv.slice(1).split('\r\n')).toHaveLength(3)

    // Close -> student blocked
    await p.goto('/dashboard')
    await card(p, TITLE).getByRole('button', { name: 'Close' }).click()
    await p.getByRole('dialog').getByRole('button', { name: 'Close Survey' }).click()
    await expect(card(p, TITLE).getByText('Closed')).toBeVisible()
    const late = await browser.newPage()
    await late.goto(studentUrl)
    await expect(late.getByText('This survey is no longer accepting responses.')).toBeVisible()
    await late.close()
  } finally {
    // Cleanup
    if (surveyId) {
      await p.goto('/dashboard')
      await card(p, TITLE).getByRole('button', { name: 'Delete' }).click()
      await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
      await expect(card(p, TITLE)).toHaveCount(0)
    }
    if (previouslyActive) {
      await card(p, previouslyActive).getByRole('button', { name: 'Activate' }).click()
      await expect(p).toHaveURL(/\/present$/)
    }
    await ictx.close()
  }
})
