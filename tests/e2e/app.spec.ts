// End-to-end tests: real production build in Chrome, real SQL/RLS via the
// PGlite-backed Supabase stand-in. Tests run in order and share state, like a class.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import jsQR from 'jsqr'
import { readFile } from 'node:fs/promises'
import { PNG } from 'pngjs'

const INSTRUCTOR = { email: 'instructor@example.com', password: 'correct-horse-battery' }
const TITLE = 'Recursion Concept Check'
const SHOTS = 'test-results/screenshots'
const PHONE = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }

test.describe.configure({ mode: 'serial' })

let instructor: Page
let surveyUrl = ''
let surveyId = ''
let copyUrl = ''

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(INSTRUCTOR.email)
  await page.getByLabel('Password').fill(INSTRUCTOR.password)
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function a11y(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    serious.map((v) => `${name}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

async function student(browser: Browser): Promise<[BrowserContext, Page]> {
  const ctx = await browser.newContext(PHONE)
  return [ctx, await ctx.newPage()]
}

function card(page: Page, title: string) {
  return page.locator('li').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
}

test.beforeAll(async ({ browser, request }) => {
  await request.post('http://127.0.0.1:54329/__reset')
  instructor = await (await browser.newContext()).newPage()
})

test('landing page links to instructor login', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Classroom Survey' })).toBeVisible()
  await page.getByRole('link', { name: 'Instructor Login' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await a11y(page, 'login')
})

test('instructor routes require login', async ({ page }) => {
  for (const path of [
    '/dashboard',
    '/surveys/new',
    '/surveys/x/edit',
    '/surveys/x/results',
    '/surveys/x/present',
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
  }
})

test('wrong password is rejected with a friendly message', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(INSTRUCTOR.email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
  await expect(page).toHaveURL(/\/login$/)
})

test('login, session persists across reload, logout', async ({ page }) => {
  await login(page)
  await expect(page.getByText(INSTRUCTOR.email)).toBeVisible()
  await expect(page.getByText('You have not created any surveys yet.')).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('editor validates required fields', async () => {
  await login(instructor)
  await a11y(instructor, 'dashboard (empty)')
  await instructor.getByRole('link', { name: 'New Survey' }).click()
  await expect(instructor).toHaveURL(/\/surveys\/new$/)
  await instructor.getByRole('button', { name: 'Save Draft' }).click()
  await expect(instructor.getByText('Title is required.')).toBeVisible()
  await expect(instructor.getByText('Question 1 needs text.')).toBeVisible()
  await expect(instructor.getByText('Choice text is required.')).toHaveCount(2)
  await expect(instructor.getByLabel('Survey Title')).toBeFocused()
  await expect(instructor.getByLabel('Survey Title')).toHaveAttribute('aria-invalid', 'true')

  await instructor.getByLabel('Question 1 choice 1').fill('Same')
  await instructor.getByLabel('Question 1 choice 2').fill(' same ')
  await instructor.getByRole('button', { name: 'Save Draft' }).click()
  await expect(instructor.getByText('Duplicate choice.')).toBeVisible()
})

test('create a survey with Multiple Choice and True/False, reorder, save draft', async () => {
  const p = instructor
  await p.getByLabel('Survey Title').fill(TITLE)
  await p.getByLabel('Description').fill('Quick understanding check')
  await p.getByLabel('Question 1 text').fill('What is required for recursion?')
  const q1 = p.locator('ol > li').nth(0)
  await q1.getByRole('button', { name: '+ Add Choice' }).click()
  await q1.getByRole('button', { name: '+ Add Choice' }).click()
  await p.getByLabel('Question 1 choice 1').fill('A pointer')
  await p.getByLabel('Question 1 choice 2').fill('A base case')
  await p.getByLabel('Question 1 choice 3').fill('A loop')
  await p.getByLabel('Question 1 choice 4').fill('A compiler')
  await p.getByRole('button', { name: 'Move choice 2 up' }).click() // base case first
  await expect(p.getByLabel('Question 1 choice 1')).toHaveValue('A base case')

  await p.getByRole('button', { name: '+ Add Question' }).click()
  const q2 = p.locator('ol > li').nth(1)
  await q2.getByLabel('Type').selectOption('true_false')
  await expect(q2.getByText('True', { exact: true })).toBeVisible()
  await expect(q2.getByText('False', { exact: true })).toBeVisible()
  await p.getByLabel('Question 2 text').fill('Every recursive function needs a stopping condition.')

  // Reorder questions and back
  await q2.getByRole('button', { name: 'Move Up' }).click()
  await expect(p.getByLabel('Question 1 text')).toHaveValue(/stopping condition/)
  await p.locator('ol > li').nth(0).getByRole('button', { name: 'Move Down' }).click()
  await expect(p.getByLabel('Question 1 text')).toHaveValue('What is required for recursion?')

  // Add and delete an unsaved empty question (no confirmation needed)
  await p.getByRole('button', { name: '+ Add Question' }).click()
  await p.locator('ol > li').nth(2).getByRole('button', { name: 'Delete Question' }).click()
  await expect(p.locator('ol > li')).toHaveCount(2)

  await a11y(p, 'editor')
  await p.getByRole('button', { name: 'Save Draft' }).click()
  await expect(p.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await expect(p).toHaveURL(/\/surveys\/[0-9a-f-]{36}\/edit$/)
  surveyId = p.url().split('/')[4]
  await p.screenshot({ path: `${SHOTS}/editor-desktop.png`, fullPage: true })
})

test('saved survey persists after reload', async () => {
  const p = instructor
  await p.reload()
  await expect(p.getByLabel('Survey Title')).toHaveValue(TITLE)
  await expect(p.getByLabel('Description')).toHaveValue('Quick understanding check')
  await expect(p.getByLabel('Question 1 choice 1')).toHaveValue('A base case')
  await expect(p.getByLabel('Question 1 choice 4')).toHaveValue('A compiler')
  await expect(p.locator('ol > li').nth(1).getByLabel('Type')).toHaveValue('true_false')
  await p.goto('/dashboard')
  await expect(card(p, TITLE).getByText('Draft')).toBeVisible()
  await expect(card(p, TITLE)).toContainText(/Created: [A-Z][a-z]{2} \d{1,2}, \d{4}/) // UI.md §4
})

test('deleting a question with text asks for confirmation', async () => {
  const p = instructor
  await p.goto(`/surveys/${surveyId}/edit`)
  await p.locator('ol > li').nth(1).getByRole('button', { name: 'Delete Question' }).click()
  const dialog = p.getByRole('dialog')
  await expect(dialog).toContainText('Delete this question?')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(p.locator('ol > li')).toHaveCount(2)
})

test('Escape closes a confirmation dialog without deleting', async () => {
  const p = instructor
  await p.locator('ol > li').nth(1).getByRole('button', { name: 'Delete Question' }).click()
  await expect(p.getByRole('dialog')).toBeVisible()
  await p.keyboard.press('Escape')
  await expect(p.getByRole('dialog')).toBeHidden()
  await expect(p.locator('ol > li')).toHaveCount(2)
})

test('activate shows QR code that decodes to the public URL', async () => {
  const p = instructor
  await p.getByRole('button', { name: 'Save & Activate' }).click()
  await expect(p).toHaveURL(new RegExp(`/surveys/${surveyId}/present$`))
  await expect(p.getByRole('heading', { name: TITLE })).toBeVisible()
  const img = p.getByRole('img', { name: /QR code linking to/ })
  await expect(img).toBeVisible()

  const urlText = await p.locator('p.font-mono').innerText()
  expect(urlText).toMatch(/^127\.0\.0\.1:4173\/s\/[a-hjkmnp-z2-9]{6}$/)
  surveyUrl = `http://${urlText}`

  const src = (await img.getAttribute('src'))!
  const png = PNG.sync.read(Buffer.from(src.split(',')[1], 'base64'))
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
  expect(decoded?.data).toBe(surveyUrl)

  const box = (await img.boundingBox())!
  expect(box.width).toBeGreaterThan(300) // large enough for projection

  const download = p.waitForEvent('download')
  await p.getByRole('link', { name: 'Download QR Code' }).click()
  expect((await download).suggestedFilename()).toBe('recursion-concept-check-qr.png')

  await expect(p.getByText('Responses:')).toContainText('0')

  // Fits a 1024×768 projector without scrolling (UI.md §6)
  await p.setViewportSize({ width: 1024, height: 768 })
  const close = (await p.getByRole('button', { name: 'Close Survey' }).boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(768)
  await p.setViewportSize({ width: 1280, height: 720 })
  await a11y(p, 'present')
  await p.screenshot({ path: `${SHOTS}/present-desktop.png` })
})

test('editing an active survey is blocked', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: await instructor.context().storageState() })
  const p = await ctx.newPage()
  await p.goto(`/surveys/${surveyId}/edit`)
  await expect(p.getByText('This survey is active. Close it before editing')).toBeVisible()
  await expect(p.getByLabel('Survey Title')).toHaveCount(0)
  await ctx.close()
})

test('student: validation, submit, confirmation, duplicate blocked (mobile)', async ({
  browser,
}) => {
  const [ctx, p] = await student(browser)
  await p.goto(surveyUrl)
  await expect(p.getByRole('heading', { name: TITLE })).toBeVisible()
  await expect(p.getByText('Quick understanding check')).toBeVisible()
  await expect(p.getByRole('link')).toHaveCount(0) // no menu / navigation
  await a11y(p, 'student survey')
  await p.screenshot({ path: `${SHOTS}/student-mobile.png`, fullPage: true })

  // Mobile layout: no horizontal scroll, 44px+ targets, wide submit button
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  for (const label of await p.locator('fieldset label').all()) {
    expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect((await p.getByRole('button', { name: 'Submit' }).boundingBox())!.width).toBeGreaterThan(
    375 * 0.8,
  )

  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(p.getByRole('alert')).toHaveText('Please answer every question.')
  await expect(p.getByText('Please choose an answer.')).toHaveCount(2)

  await p
    .getByRole('group', { name: /What is required/ })
    .getByLabel('A base case')
    .check()
  await p
    .getByRole('group', { name: /stopping condition/ })
    .getByLabel('True')
    .check()
  await expect(p.getByText('Please choose an answer.')).toHaveCount(0)
  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(p.getByRole('heading', { name: 'Thank you!' })).toBeVisible()
  await expect(p.getByText('Your response has been recorded.')).toBeVisible()

  await p.reload()
  await expect(p.getByText('You have already submitted a response to this survey.')).toBeVisible()

  // Server-side protection: forget the local flag but keep the token.
  await p.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.includes(':submitted:')) localStorage.removeItem(k)
  })
  await p.reload()
  await p
    .getByRole('group', { name: /What is required/ })
    .getByLabel('A loop')
    .check()
  await p
    .getByRole('group', { name: /stopping condition/ })
    .getByLabel('False')
    .check()
  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(p.getByText('You have already submitted a response to this survey.')).toBeVisible()
  await ctx.close()
})

test('student: second phone and keyboard-only submission', async ({ browser }) => {
  const [ctx, p] = await student(browser)
  await p.goto(surveyUrl)
  await p.getByLabel('A pointer').check()
  await p.getByLabel('True').check()
  await p.getByRole('button', { name: 'Submit' }).click()
  await expect(p.getByRole('heading', { name: 'Thank you!' })).toBeVisible()
  await ctx.close()

  const kctx = await browser.newContext()
  const k = await kctx.newPage()
  await k.goto(surveyUrl)
  await expect(k.getByRole('heading', { name: TITLE })).toBeVisible()
  await k.keyboard.press('Tab') // first radio of Q1
  await expect(k.getByLabel('A base case')).toBeFocused()
  await k.keyboard.press('Space')
  await k.keyboard.press('Tab') // Q2 group
  await k.keyboard.press('ArrowDown') // True -> False
  await expect(k.getByLabel('False')).toBeChecked()
  await k.keyboard.press('Tab')
  await expect(k.getByRole('button', { name: 'Submit' })).toBeFocused()
  await k.keyboard.press('Enter')
  await expect(k.getByRole('heading', { name: 'Thank you!' })).toBeVisible()
  await kctx.close()
})

test('present page response count updates live', async () => {
  await expect(instructor.getByText('Responses:')).toContainText('3', { timeout: 10_000 })
})

test('results show correct counts, percentages, and charts', async () => {
  const p = instructor
  await p.getByRole('link', { name: 'View Results' }).click()
  await expect(p.getByText('3 responses')).toBeVisible()

  const q1 = p.locator('ol > li').nth(0)
  const rows = async (q: typeof q1) =>
    (await q.locator('tbody tr').allInnerTexts()).map((r) => r.split('\t').map((s) => s.trim()))
  expect(await rows(q1)).toEqual([
    ['A base case', '2', '66.7%'],
    ['A pointer', '1', '33.3%'],
    ['A loop', '0', '0.0%'],
    ['A compiler', '0', '0.0%'],
  ])
  expect(await rows(p.locator('ol > li').nth(1))).toEqual([
    ['True', '2', '66.7%'],
    ['False', '1', '33.3%'],
  ])
  await expect(q1.locator('.recharts-bar-rectangle')).toHaveCount(4) // zero bars drawn as a 2px sliver
  await expect(q1.locator('svg').getByText('2 (66.7%)')).toBeVisible()
  await expect(q1.locator('svg').getByText('1 (33.3%)')).toBeVisible()
  await expect(q1.locator('svg').getByText('0 (0.0%)')).toHaveCount(2) // zero values still labelled
  await a11y(p, 'results')
  await p.screenshot({ path: `${SHOTS}/results-desktop.png`, fullPage: true })
})

test('CSV export contains one row per response with escaped values', async () => {
  const p = instructor
  const download = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Export CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(
    /^recursion-concept-check-results-\d{4}-\d{2}-\d{2}\.csv$/,
  )
  const text = await readFile((await file.path())!, 'utf8')
  expect(text.charCodeAt(0)).toBe(0xfeff) // BOM for Excel
  const lines = text.slice(1).split('\r\n')
  expect(lines[0]).toBe(
    'response_id,submitted_at,What is required for recursion?,Every recursive function needs a stopping condition.,survey_title,survey_created_at',
  )
  expect(lines).toHaveLength(4)
  const answers = lines.slice(1).map((l) => l.split(',').slice(2, 4).join(','))
  expect(answers.sort()).toEqual(['A base case,False', 'A base case,True', 'A pointer,True'])
  for (const l of lines.slice(1))
    expect(l).toMatch(
      /^[0-9a-f-]{36},\d{4}-\d{2}-\d{2}T[^,]+,[^,]+,[^,]+,Recursion Concept Check,\d{4}-\d{2}-\d{2}T[^,]+$/,
    )
})

test('refresh picks up new responses', async ({ browser }) => {
  const [ctx, s] = await student(browser)
  await s.goto(surveyUrl)
  await s.getByLabel('A loop').check()
  await s.getByLabel('False').check()
  await s.getByRole('button', { name: 'Submit' }).click()
  await expect(s.getByRole('heading', { name: 'Thank you!' })).toBeVisible()
  await ctx.close()
  await instructor.getByRole('button', { name: 'Refresh' }).click()
  await expect(instructor.getByText('4 responses')).toBeVisible()
})

test('student sees friendly messages on network failure', async ({ browser }) => {
  const [ctx, s] = await student(browser)
  await s.route('**/rest/v1/**', (r) => r.abort())
  await s.goto(surveyUrl)
  // supabase-js retries failed GETs 3x (1s, 2s, 4s) before giving up
  await expect(s.getByRole('heading', { name: 'Could not load the survey.' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(s.getByRole('button', { name: 'Try Again' })).toBeVisible()

  await s.unroute('**/rest/v1/**')
  await s.reload()
  await s.getByLabel('A base case').check()
  await s.getByLabel('True').check()
  await s.route('**/rest/v1/rpc/submit_survey_response', (r) => r.abort())
  await s.getByRole('button', { name: 'Submit' }).click()
  await expect(s.getByRole('alert')).toHaveText(
    'Network error. Check your connection and try again.',
  )
  await expect(s.getByRole('button', { name: 'Submit' })).toBeEnabled() // can retry
  await ctx.close()
})

test('only one active survey: activating a duplicate closes the original', async ({ browser }) => {
  const p = instructor
  await p.goto('/dashboard')
  await card(p, TITLE).getByRole('button', { name: 'Duplicate' }).click()
  await expect(p).toHaveURL(/\/edit$/)
  await expect(p.getByLabel('Survey Title')).toHaveValue(`Copy of ${TITLE}`)
  await expect(p.getByLabel('Question 1 choice 1')).toHaveValue('A base case')
  await p.getByRole('link', { name: 'Back to Dashboard' }).click()

  // Activate copy from dashboard -> confirmation names the active survey
  await card(p, `Copy of ${TITLE}`).getByRole('button', { name: 'Activate' }).click()
  const dialog = p.getByRole('dialog')
  await expect(dialog).toContainText(`"${TITLE}" is currently active and will be closed.`)
  await dialog.getByRole('button', { name: 'Activate' }).click()
  await expect(p).toHaveURL(/\/present$/)
  copyUrl = `http://${await p.locator('p.font-mono').innerText()}`
  expect(copyUrl).not.toBe(surveyUrl)

  await p.goto('/dashboard')
  await expect(card(p, TITLE).getByText('Closed')).toBeVisible()
  await expect(card(p, `Copy of ${TITLE}`).getByText('Active')).toBeVisible()
  await expect(p.locator('ul > li').getByText('Active', { exact: true })).toHaveCount(1)

  const [ctx, s] = await student(browser)
  await s.goto(surveyUrl)
  await expect(s.getByText('This survey is no longer accepting responses.')).toBeVisible()
  await s.goto(surveyUrl.replace(/\/s\/.*/, '/s/zzzzzz'))
  await expect(s.getByText('Survey not found.')).toBeVisible()
  await ctx.close()
})

test('closing stops submissions even if the student page is already open', async ({ browser }) => {
  const [ctx, s] = await student(browser)
  await s.goto(copyUrl)
  await s.getByLabel('A base case').check()
  await s.getByLabel('True').check()

  const p = instructor
  await card(p, `Copy of ${TITLE}`).getByRole('button', { name: 'Close' }).click()
  await expect(p.getByRole('dialog')).toContainText('Students will no longer be able to submit')
  await p.getByRole('dialog').getByRole('button', { name: 'Close Survey' }).click()
  await expect(card(p, `Copy of ${TITLE}`).getByText('Closed')).toBeVisible()

  await s.getByRole('button', { name: 'Submit' }).click()
  await expect(s.getByText('This survey is no longer accepting responses.')).toBeVisible()
  await ctx.close()
})

test('closed survey can be edited and saved without losing results', async () => {
  const p = instructor
  await card(p, TITLE).getByRole('link', { name: 'Edit' }).click()
  await expect(p.getByText('This survey already has 4 responses.')).toBeVisible()
  await p.getByLabel('Question 1 choice 3').fill('A while loop')
  await p.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(p.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await p.goto(`/surveys/${surveyId}/results`)
  await expect(p.getByText('4 responses')).toBeVisible()
  await expect(p.getByRole('link', { name: 'Present QR' })).toBeVisible() // closed: can re-present
  await expect(p.locator('ol > li').nth(0).locator('tbody tr').nth(2)).toContainText('A while loop')
  await expect(p.locator('ol > li').nth(0).locator('tbody tr').nth(2)).toContainText('1')
})

test('archive keeps historical results; dashboard filters work', async () => {
  const p = instructor
  await p.goto('/dashboard')
  await card(p, TITLE).getByRole('button', { name: 'Archive' }).click()
  await p.getByRole('dialog').getByRole('button', { name: 'Archive' }).click()
  await expect(card(p, TITLE).getByText('Archived')).toBeVisible()
  await expect(card(p, TITLE).getByRole('link', { name: 'Edit' })).toHaveCount(0)

  await p.getByLabel('Search').fill('copy')
  await expect(p.locator('ul > li')).toHaveCount(1)
  await p.getByLabel('Search').fill('')
  await p.getByLabel('Status').selectOption('archived')
  await expect(p.locator('ul > li')).toHaveCount(1)
  await p.getByLabel('Status').selectOption('all')
  await p.getByLabel('Created to').fill('2000-01-01')
  await expect(p.getByText('No surveys match your search.')).toBeVisible()
  await p.getByLabel('Created to').fill('')
  await expect(p.locator('ul > li')).toHaveCount(2)
  await a11y(p, 'dashboard')
  await p.screenshot({ path: `${SHOTS}/dashboard-desktop.png`, fullPage: true })

  await card(p, TITLE).getByRole('link', { name: 'Results' }).click()
  await expect(p.getByText('4 responses')).toBeVisible()
  await expect(p.getByRole('link', { name: 'Present QR' })).toHaveCount(0)
})

test('delete warns about responses, can be cancelled, and removes the survey', async () => {
  const p = instructor
  await p.goto('/dashboard')
  await card(p, TITLE).getByRole('button', { name: 'Delete' }).click()
  const dialog = p.getByRole('dialog')
  await expect(dialog).toContainText('This survey has 4 responses.')
  await expect(dialog).toContainText('Consider archiving instead.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(card(p, TITLE)).toHaveCount(1)

  await card(p, `Copy of ${TITLE}`).getByRole('button', { name: 'Delete' }).click()
  await expect(dialog).toContainText(
    'This will permanently delete the survey and all of its responses.',
  )
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(card(p, `Copy of ${TITLE}`)).toHaveCount(0)
  await expect(card(p, TITLE)).toHaveCount(1)
})

test('instructor pages are usable on a phone', async ({ browser }) => {
  const ctx = await browser.newContext({
    ...PHONE,
    storageState: await instructor.context().storageState(),
  })
  const p = await ctx.newPage()
  for (const path of ['/dashboard', `/surveys/${surveyId}/results`, '/surveys/new']) {
    await p.goto(path)
    await expect(p.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await p.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(
      375,
    )
  }
  // Results bars keep usable width on a phone
  await p.goto(`/surveys/${surveyId}/results`)
  await expect(p.locator('.recharts-bar-rectangle').first()).toBeVisible()
  const widths = await Promise.all(
    (await p.locator('.recharts-bar-rectangle').all()).map(
      async (b) => (await b.boundingBox())!.width,
    ),
  )
  expect(Math.max(...widths)).toBeGreaterThan(70)
  await p.goto('/dashboard')
  await expect(card(p, TITLE)).toBeVisible()
  await p.screenshot({ path: `${SHOTS}/dashboard-mobile.png`, fullPage: true })
  await ctx.close()
})

test('students never download instructor code (Recharts)', async ({ browser }) => {
  const [ctx, s] = await student(browser)
  const scripts: string[] = []
  s.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()))
  await s.goto(surveyUrl)
  await expect(s.getByText('This survey is no longer accepting responses.')).toBeVisible()
  expect(scripts.some((u) => /Results|Dashboard|SurveyEditor|PresentSurvey/.test(u))).toBe(false)
  await ctx.close()
})
