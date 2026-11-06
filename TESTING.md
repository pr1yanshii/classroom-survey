# Testing

**Last full run:** November 5, 2026, after the CSV metadata change. Run on macOS 14 (Darwin 23.6) with
Node 24.22. Every result below comes from an actual run.

## How to run the tests

| Command | What it runs | What it needs |
|---------|--------------|---------------|
| `npm run typecheck` | `tsc -b` over the app, config and test code | Nothing extra |
| `npm run lint` | oxlint | Nothing extra |
| `npm test` | Unit tests and database tests (Vitest) | Nothing extra |
| `npm run test:e2e` | Browser tests in Chrome and Firefox (Playwright) | Google Chrome installed; run `npx playwright install firefox` once |
| `npm run test:live` | Tests against **my real** Supabase project | Migrations applied; `LIVE_EMAIL` and `LIVE_PASSWORD` set |
| `npm run test:prod` | The full instructor and student workflow in Chrome, against the **deployed** site | `.env.test.local` with `PROD_URL`, `LIVE_EMAIL` and `LIVE_PASSWORD` |
| `npm run build` | Production build | `.env.local` |

## Kinds of tests

| Kind | Folder | Runs against | What it checks |
|------|--------|--------------|----------------|
| Unit | `tests/unit/` | Nothing (plain functions) | CSV escaping and the formula-injection guard, result percentages, CSV row layout, editor validation, error messages, the anonymous token |
| Database | `tests/db/` | PGlite 0.5, which is real PostgreSQL 18.6 compiled to WebAssembly. It runs the actual migration files, with Supabase's `anon` and `authenticated` roles and default permissions recreated | Constraints, Row Level Security, permissions, every database function, the one-active-survey rule, all-or-nothing submissions, cascading deletes |
| Browser (end-to-end) | `tests/e2e/` | The production build in real browsers, talking to `tests/e2e/fake-supabase.ts`. This is a local stand-in that handles the login, REST and RPC calls this app makes. It runs every query on PGlite as the caller's role | Full instructor and student flows through the real UI, reading the QR code, CSV download, phone layout, keyboard use, an axe accessibility scan |
| Live | `tests/live/` | My real Supabase project, through the app's own `src/lib/api.ts` | Real Supabase login, REST API, Row Level Security and database functions. **Not run yet** (see Limitations) |
| Production | `tests/prod/` | The deployed Cloudflare Pages site and the live Supabase project, in Chrome | Login, create, activate, read the QR code, two phone submissions, duplicate blocking, live count, results, CSV, close, then clean up. **Not run yet** |

## Results

| Check | Result |
|-------|--------|
| TypeScript (`tsc -b`, app and tests) | Pass, 0 errors |
| Lint (oxlint) | Pass, 0 errors, 0 warnings (after fix #3 below) |
| Prettier check | Pass for `src/`, `tests/` and all Markdown files. Two config files (`.oxlintrc.json`, `tsconfig.test.json`) are not Prettier-formatted (style only) |
| Unit tests | **20 / 20 passed** |
| Database tests | **32 / 32 passed** |
| Browser tests, Google Chrome 156 (installed) | **25 / 25 passed** |
| Browser tests, Firefox (Playwright build 1572) | **25 / 25 passed** |
| Live Supabase tests (`npm run test:live`) | **Not run: 10 skipped.** `LIVE_EMAIL` and `LIVE_PASSWORD` were not available locally |
| Production workflow (`npm run test:prod`) | **Not run: 1 skipped.** No `.env.test.local` (`PROD_URL`, `LIVE_EMAIL`, `LIVE_PASSWORD`) was available locally |
| Production build | Pass. The student page loads 141.7 kB of JavaScript (gzipped). The Recharts chunk (95.5 kB gzipped) loads only on the results page |

### Production checks that did run (anonymous, no credentials)

Claude Code ran these on November 5, 2026 against <https://classroom-survey-63r.pages.dev>, twice:

- **First run:** against the deployment of commit `e9707d4`.
- **Second run:** after commit `3af973b` was pushed and its "Cloudflare Pages" check on GitHub passed.

The results were the same both times, except for the rows marked below.

| Check | Result |
|-------|--------|
| `GET /` and the deep link `GET /s/zzzzzz` | Both returned HTTP 200, so the `_redirects` routing works |
| Deployed code settings | The deployed code has the same Supabase project URL and publishable key as `.env.local` (compared without printing them). There is no secret or `service_role` key. The only `sb_secret_` text found is supabase-js library code that checks key prefixes |
| Migrations applied on live Supabase | Yes. An anonymous `GET /rest/v1/surveys` returned `200 []` (no active survey). An anonymous `GET /rest/v1/responses` returned `401 permission denied for table responses`, so the permissions and RLS are in place. An anonymous `rpc/get_survey_status` call returned `200 null` for an unknown code |
| Chrome, `/s/zzzzzz` | Shows "Survey not found." It took about 1.6 s on the first run and 1.1 s on the second, including the Supabase lookup |
| Chrome, `/` | The landing page renders, with no "Supabase is not configured" message |
| Chrome, `/dashboard` while signed out | Redirects to `/login` |
| Chrome, wrong login details | Shows "Invalid email or password.", which came from real Supabase Auth |
| Supabase Auth settings (`/auth/v1/settings`) | First run: `disable_signup: false` (public sign-up was on). **Second run: `disable_signup: true`**, so public sign-up is now off |
| CSV change on the live site (second run) | The live site serves the same files as the local build of `3af973b` (`index-BCtea890.js`, `Results-Ck41Q37i.js`). The live results code contains `survey_title` and `survey_created_at`. An actual CSV download on the live site has not been tested |
| All 5 tables and 7 functions exist on live Supabase (third run, after my own check in the dashboard) | Each was called anonymously in a way that can't change data. `surveys`, `questions` and `choices` return `200`; `responses` and `answers` return `permission denied`, which shows they exist (a missing table returns "not found"). `activate_survey`, `close_survey`, `save_survey`, `duplicate_survey` and `survey_choice_counts` return `permission denied for function` to anonymous users, as intended. `get_survey_status` returns `200 null` for an unknown code. `submit_survey_response` rejects a made-up survey with `SURVEY_NOT_ACTIVE` and saves nothing |

**Not yet checked on the live site:**
- instructor login;
- creating and activating a survey;
- the QR code on the live domain;
- student submission and duplicate blocking;
- results, CSV and closing.

These need the instructor login (`npm run test:prod`) or the manual checklist in README §6.

### Which tests cover each requirement

| Requirement | Checked by |
|-------------|------------|
| Instructor login | Browser: 5 protected routes redirect to `/login`; a wrong password shows "Invalid email or password."; the session survives a reload; logout works. Database: anonymous users cannot call instructor functions or write to tables |
| Creating and editing surveys | Browser: missing fields and duplicate choices show errors next to the field (with `aria-invalid` and focus); Multiple Choice and True/False; adding, reordering and deleting choices and questions; saving a draft; data still there after reload; editing a closed survey keeps its results. Database: `save_survey` validation, rollback on bad input, keeping IDs, rejecting IDs from another survey |
| Activating, closing, one active survey | Browser: Save & Activate opens the present page; activating a second survey asks first and closes the original; the dashboard shows exactly one Active; editing an active survey is blocked. Database: the unique index blocks a second active survey; a survey with no questions can't be activated; reactivating keeps the same code |
| QR code | Browser: the QR image, decoded with jsQR, equals the URL on screen; it is over 300 px wide; the PNG download has the expected file name |
| Anonymous student submission | Browser (375×812 touch screen): no links or menus; validation messages; Submit leads to "Thank you!"; submitting with the keyboard only (Tab, Space, arrow keys, Enter) |
| Duplicate prevention | Browser: coming back shows "already submitted". With the browser's "submitted" flag cleared but the same token, the server still rejects it with the same message. Database: unique `(survey_id, anonymous_token)` and a check in the function |
| Closed or unknown survey | Browser: a closed survey's link shows "no longer accepting responses"; an unknown code shows "Survey not found."; if the survey closes while a student has it open, Submit shows the closed message |
| Data persistence | Browser: data survives a reload. Database: archiving keeps responses; deleting removes everything linked to the survey |
| Results calculations | Unit: the UI.md example (45/3/2/2 of 52 → 86.5/5.8/3.8/3.8 %). Browser: 3 responses give 66.7 / 33.3 / 0.0 / 0.0 % in the table and chart labels; Refresh picks up a 4th response; the present page's live count reaches 3 |
| CSV export | Browser: the file starts with a BOM; the header is the question text followed by `survey_title,survey_created_at`; there is one row per response with a UUID, an ISO timestamp and the right answers; every row has the survey title and creation date. Unit: same layout, plus quoting, quotes and line breaks inside values, and a `'` added before values starting with `= + - @` |
| Security and Row Level Security | Database: anonymous users see only the active survey and its questions and choices. They get `permission denied` when reading or writing responses and answers, and when writing surveys directly. Bad or mismatched submissions are rejected and save nothing |
| Desktop and phone usability | Browser: no sideways scrolling at 375 px on the student, dashboard, results and editor pages; answer buttons at least 44 px; Submit button over 80 % of the width; axe finds no serious or critical problems on the login, dashboard, editor, present, student and results pages. Screenshots were reviewed (`test-results/screenshots/`) |
| Network errors | Browser: if the survey can't load, "Could not load the survey." and a Try Again button appear, after supabase-js's 3 automatic retries. If a submission fails, "Network error…" appears and Submit works again |
| Performance | Browser: the student page never downloads the dashboard, editor, present or results code |

## Bugs found and fixed

| # | Bug | How it was found | Fix |
|---|-----|------------------|-----|
| 1 | The results chart showed no bar **and no count or percentage** for choices with 0 answers. UI.md §9 says charts must always show counts and percentages | Browser test of the results page | Added `minPointSize={2}` to the bar, so zero rows show a thin bar with their label (`src/pages/Results.tsx`) |
| 2 | The Count and Percent columns didn't line up between question tables | Reviewing screenshots | Fixed column widths |
| 3 | 4 lint warnings (`react/set-state-in-effect`) on the code that loads page data | Lint | Reviewed and found safe. State is set after `await`, React 19 ignores updates after a component unmounts, and these pages remount on navigation. The rule was turned off in `.oxlintrc.json` (and documented) instead of restructuring four pages |
| 4 | Results chart unreadable on phones: a fixed 170 px label column left only about 20 px for the bars | UI review screenshots at 375 px | Narrower labels and margins below 640 px. The full choice text is still in the table. A browser test checks the bars are over 70 px wide on a phone |
| 5 | The present page didn't fit a 1024×768 projector. Close Survey was below the bottom of the screen, and long titles made it worse | UI review screenshots | The QR code is sized `min(80vw, 50vh)`, spacing is tighter, and the title only grows to 5xl at 1280 px or wider. A browser test checks all buttons fit at 1024×768 |
| 6 | The results page showed "Present QR" only for active surveys. But UI.md §9 lists it, and the empty state says "Display the QR code" | UI.md review | It now shows for every survey that isn't archived (the present page offers Activate when a survey is closed). A browser test checks it on a closed survey |
| 7 | The dashboard showed dates as `11/5/2026`, but the wireframe shows `Aug 17, 2026` | UI.md §4 review | Uses the short month format now. A browser test checks the format |
| 8 | The CSV export had no survey metadata (the title and date were only in the file name), so TODO.md Phase 11 "Export survey metadata" was still open | Final review of API.md §12 and TODO.md | Added `survey_title` and `survey_created_at` columns after the question columns. API.md's recommended `response_id,submitted_at,question_…` layout and the question-text header row stay the same (`src/lib/results.ts`). The unit, browser and production tests were updated |

**Bugs fixed earlier, while building the app (Stages 1–2 of the same session):**
- Tailwind v4 `@apply` with custom classes broke the build, so those styles moved to `@utility`.
- A build without the environment variables produced an empty app, so a setup message was added.
- Everything was in one 854 kB bundle, so the instructor pages were split into separate chunks.

**Mistakes in the tests, not the app** (the app was right and the test was wrong):
- Recharts draws no rectangle for a 0 value.
- "Back to Dashboard" is a link, not a button.
- A screenshot was taken before the data loaded.
- The load-failure message only appears after supabase-js finishes retrying (about 7 s), so that test
  now waits up to 15 s.

## UI review against UI.md and the specification (November 5, 2026)

- **How it was done:** every page was rendered with realistic data and compared with the UI.md
  wireframes. The data included long titles and choices, 10 responses and all four statuses. Four
  screen sizes were used: 375×812 phone, 768×1024 tablet, 1280×800 desktop and 1024×768 projector.
- **What was confirmed present:** all routes (§1), page elements and buttons (§2–9), student states
  (§8), empty states (§10), confirmation dialogs (§11) and loading and saving messages (§15).
- **What it found:** bugs 4–7 above.
- **Differences kept on purpose:**
  - Status is shown as a badge instead of "Status: Draft", since UI.md §4 recommends badges.
  - The editor's Activate button says "Save & Activate", because it saves first.
  - The dashboard and present page have a few extra buttons: Results, Delete, Download QR and Full
    Screen.

## Limitations (not verified)

- **Logged-in features not tested on the live project.** The migrations are applied (see the checks
  above). But `npm run test:live` and `npm run test:prod` have not run, because the instructor login
  was not available locally. The local stand-in only copies the Supabase calls this app makes.
- **Safari and iOS not tested.** Playwright's WebKit build for macOS 14 fails to start with this
  Playwright version (`Unknown setting: PushAPIEnabled`). Phone layouts were tested with Chrome's device
  emulation. Firefox ignores `isMobile`, so in Firefox only the screen size was tested.
- **No load test.** The 200-students-at-once requirement has not been measured. PGlite runs one
  connection, so many activations or submissions happening at the same moment were not tested.
- **QR code read by software, not a phone camera.** Readability on a real projector has not been
  checked.
- **CSV not opened in Excel or Google Sheets.** Only the file format was checked.
- **Duplicate protection works per browser.** A private window or cleared storage gets a new token.
  This is an accepted limit of anonymous surveys.
- **The present page only refreshes the response count.** If the survey is closed from another tab,
  the present page keeps showing the QR code until it is reloaded.
- **Public sign-up must stay off.** Any signed-in user has full instructor access (one-instructor
  design, DECISIONS.md #4). Sign-up was on at the first check and off at the second. If it is turned
  back on, anyone who signs up and confirms their email could read or delete data.
