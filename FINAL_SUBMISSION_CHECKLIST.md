# Final Submission Checklist

This compares each requirement with what the project actually does. It was checked on November 5,
2026, using the code in this repository and the test runs recorded in [TESTING.md](TESTING.md).

**Where the requirements come from:** the repository has no separate grading rubric file, so this
checklist uses:
- the main specification: goals (§2), users (§3), features (§4), performance and security (§5),
  database (§6), technology (§7), folder structure (§8) and MVP (§9);
- DATABASE.md, API.md and UI.md;
- the requirements in my prompts (see [AI_DEVELOPMENT_HISTORY.md](AI_DEVELOPMENT_HISTORY.md)).

If the course has a separate rubric, it should be checked against this list as well.

**Status key**

| Status | Meaning |
|--------|---------|
| **Done (local)** | Built and passing automated tests on my local test setup (real migrations on PGlite and the local Supabase stand-in). Not yet checked on the live site |
| **Done (prod)** | Also checked on the live site, <https://classroom-survey-63r.pages.dev> |
| **Unverified (prod)** | Built, but not yet checked on the live site |
| **Partial** | Only partly met. The note explains what is missing |
| **Not done** | Not built or not tested |
| **Manual** | Has to be checked by a person (real phone, projector, spreadsheet app, screenshots) |

## 1. MVP (specification §9)

| Requirement | Status | Evidence / notes |
|-------------|--------|------------------|
| Instructor authentication | Done (local), Partial (prod) | Supabase email and password login, and protected pages. On the live site, the login redirect and wrong-password rejection were checked, but a real instructor login was not. **Public sign-up is still on (see §8)** |
| Survey creation and editing | Done (local), Unverified (prod) | `src/pages/SurveyEditor.tsx` and the `save_survey` function. Covered by browser and database tests |
| Multiple-choice questions | Done (local), Unverified (prod) | The browser tests create and answer them |
| True/False questions | Done (local), Unverified (prod) | Fixed True/False choices; browser tests |
| QR code generation | Done (local), Unverified (prod) | The browser tests read the QR code and compare it with the URL on screen. It has not yet been checked showing the `pages.dev` address, or scanned with a phone |
| Student submission page | Done (local), Partial (prod) | `/s/:slug`. On the live site, the direct link and the "Survey not found." message were checked, but no real submission has been made |
| PostgreSQL storage | Done (local), Partial (prod) | The migrations have been run on the live project (checked without logging in). Data surviving a reload was tested locally |
| Results dashboard | Done (local), Unverified (prod) | Counts, percentages, bar charts and Refresh. The example numbers from UI.md are unit-tested |
| Historical browsing | Done (local), Unverified (prod) | Dashboard search plus status and date filters. Closed and archived surveys keep their results |
| CSV export | Done (local), Unverified (prod) | One row per response with a question-text header, plus `survey_title` and `survey_created_at`. These two columns were added in the final stage and are **not deployed yet** |

## 2. Users (specification §3)

| Requirement | Status | Evidence / notes |
|-------------|--------|------------------|
| Instructor can create, edit, duplicate, delete and archive | Done (local) | Dashboard buttons with confirmation dialogs; the `duplicate_survey` function. Deleting a survey also deletes its questions and responses (tested) |
| Instructor can activate and close | Done (local) | `activate_survey` and `close_survey` functions |
| Instructor can display QR codes | Done (local) | Present page with a large QR code, a readable URL and a Full Screen button |
| Instructor can view live and past responses | Done (local) | The present page updates the response count every 3 seconds. The results page has a Refresh button. The charts do not update live, but that is listed as a future feature (§10) |
| Instructor can export results | Done (local) | Export CSV button |
| Student can scan, complete and submit | Done (local), Manual | Tested with a QR decoder and a phone-sized browser. **Not yet scanned with a real phone** |
| Student gets a confirmation | Done (local) | "Thank you!" screen |
| No student account needed | Done (local) | Only a random anonymous token is stored in the browser |

## 3. Features (specification §4)

| Requirement | Status | Evidence / notes |
|-------------|--------|------------------|
| A survey has a title, an optional description and at least one question | Done (local) | Checked in the editor and in `save_survey` |
| Statuses: Draft, Active, Closed, Archived | Done (local) | Database check constraint; status badges in the UI |
| Only one survey can be active | Done (local) | The `only_one_active_survey` index. Activating a survey closes the old one. Database and browser tests |
| Activation creates a public URL, a QR code and a downloadable PNG | Done (local) | The short code is made at activation. "Download QR Code" is tested |
| Works in any modern browser on phones, tablets and laptops | Partial | Tested automatically in Chrome and Firefox. **Safari and iPhone are not tested**, because Playwright's Safari engine would not start on macOS 14 |
| Results show counts, percentages, charts and past surveys | Done (local) | See §1 |
| Export all results as CSV | Done (local) | Results are loaded in pages, so large surveys are not cut off at 1000 rows |

## 4. Performance and security (specification §5)

| Requirement | Status | Evidence / notes |
|-------------|--------|------------------|
| Mobile-friendly layout | Done (local), Manual | Tested at 375 px wide: no sideways scrolling, touch targets at least 44 px, accessibility scan passed. Not checked on real devices |
| At least 200 students at once | **Not done** | No load test. The design should handle it (static hosting, one database call per submission, a unique index for duplicates), but it has **not been measured** |
| Average page load under 2 seconds | Partial | The student page's JavaScript is 141.7 kB gzipped, and the chart library only loads on the results page. On the live site, one cold load of `/s/zzzzzz` took about 1.6 s in Chrome on one network. This was not measured systematically |
| Secure instructor login | **Partial** | Supabase login, Row Level Security on every table, explicit permissions and no sign-up page. **But public sign-up is on in the live project**, and any signed-in user has full access. It must be turned off (§8) |
| Free hosting | Done | Cloudflare Pages and Supabase. Claude Code did not check which Supabase plan I'm on |

## 5. Database (specification §6 and DATABASE.md)

| Requirement | Status | Evidence / notes |
|-------------|--------|------------------|
| Five tables with the specified columns | Done | `supabase/migrations/20261105000000_initial_schema.sql`. Extra columns: `public_slug` and `updated_at` on `surveys`, and `created_at` on the other tables |
| Foreign keys, cascades, checks and indexes | Done (local) | Database tests |
| Unique `(survey_id, anonymous_token)` | Done (local) | Database and browser duplicate tests |
| Row Level Security: students can read only the active survey and never responses | Done (local), Partial (prod) | On the live site, an anonymous read of `responses` returned "permission denied", and an anonymous read of `surveys` returned only active surveys (there were none at the time) |
| Safe, all-or-nothing submission function | Done (local) | `submit_survey_response`. Bad or mismatched submissions save nothing |
| Migrations in the repository | Done | Two files, run in order (README §2) |

## 6. Technology and folder structure (specification §7 and §8)

| Requirement | Status | Notes |
|-------------|--------|-------|
| React, TypeScript, Vite, Tailwind CSS | Done | React 19, TypeScript 7, Vite 8, Tailwind 4 |
| Supabase and PostgreSQL | Done | |
| Recharts and the `qrcode` npm package | Done | |
| Cloudflare Pages | Done | GitHub shows a passing "Cloudflare Pages" check on `main` |
| GitHub | Done | <https://github.com/pr1yanshii/classroom-survey> (public) |
| `src/components`, `src/pages`, `src/lib`, `supabase/`, `public/`, `README.md`, `SPEC.md`, `TODO.md` | Done | `SPEC.md` links to the original specification files |
| ESLint (TODO.md Phase 1) | Partial (on purpose) | oxlint and Prettier are used instead, because `typescript-eslint` doesn't support TypeScript 7 yet (DECISIONS.md #17) |

## 7. Submission items

| Item | Status | Notes |
|------|--------|-------|
| Source code on GitHub | Done | **The final-stage changes (CSV columns and these documents) are not committed or pushed yet** |
| The five original specification files | Done | API.md, DATABASE.md, UI.md and the main specification are unchanged. Their file dates are 18:56, before work started, and git shows no changes. In TODO.md only the checkboxes and status notes changed |
| Updated TODO.md | Done | Phases 11 and 15 were updated in the final stage |
| Database migrations | Done | `supabase/migrations/` |
| README with setup, environment variables, testing and deployment | Done | Includes the live URL and the deployment status |
| DECISIONS.md and TESTING.md | Done | 18 decisions; test results come from real runs |
| No exposed secrets; `.env` files ignored | Done | Every tracked file was checked. Only `.env.example`, which has placeholders, is tracked. The deployed code contains only the public key |
| Public live URL | Done | <https://classroom-survey-63r.pages.dev> |
| Full workflow checked on the live site | **Not done** | Only the checks that don't need a login have been run. `npm run test:prod` needs my login details |
| DEVELOPMENT_SUMMARY.md | Done | |
| AI_DEVELOPMENT_HISTORY.md | Done | My exact prompts, plus clearly marked summaries |
| Screenshots | **Not done (Manual)** | 18 are listed in [EVIDENCE.md](EVIDENCE.md). None have been taken yet |

## 8. What I still need to do (most important first)

1. **Turn off public sign-up.** In Supabase, go to Authentication → Sign In / Providers → Email and
   turn off "Allow new users to sign up". Until then, a stranger could sign up through the Supabase API,
   confirm their email and get full instructor access.
2. **Commit and push the final changes.** This puts the new documents on GitHub and makes Cloudflare
   deploy the CSV columns.
3. **Check the logged-in workflow on the live site.** I can create `.env.test.local` with `PROD_URL`,
   `LIVE_EMAIL` and `LIVE_PASSWORD`, then run `npm run test:live` and `npm run test:prod`. Or I can go
   through the manual checklist in README §6. After that, tick the last three Phase 15 items in TODO.md.
4. **Take the screenshots** listed in [EVIDENCE.md](EVIDENCE.md).
5. **Test on real devices.** Scan the QR code with an iPhone (Safari) and an Android phone, and check
   the present page on the classroom projector.
6. **Open an exported CSV** in Excel or Google Sheets. Then tick "Test export with spreadsheet
   applications" in TODO.md Phase 11.
7. *(Optional)* **Run a load test** for the 200-student requirement, or leave it listed as a known
   limitation.

## 9. Known limitations (accepted and documented)

- **Duplicate protection works per browser.** A student can submit again from a private window or after
  clearing browser storage. This is the normal trade-off for anonymous surveys.
- **The present page doesn't notice a close made elsewhere.** If the survey is closed in another tab,
  the present page keeps showing the QR code until it is reloaded.
- **Post-MVP features are not built.** Features like live charts, a question bank and LMS integration
  (TODO.md Phase 16, specification §10) are not required.
