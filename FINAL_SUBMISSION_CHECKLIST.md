# Final Submission Checklist

This compares each requirement with what the project actually does. It was checked on November 5,
2026, using the code in this repository and the test runs recorded in [TESTING.md](TESTING.md).

**Where the requirements come from:** the repository has no separate grading rubric file, so this
checklist uses:
- the main specification: goals (§2), users (§3), features (§4), performance and security (§5),
  database (§6), technology (§7), folder structure (§8) and MVP (§9);
- DATABASE.md, API.md and UI.md;
- the requirements in my prompts (see [AI_DEVELOPMENT_HISTORY.md](docs/AI_DEVELOPMENT_HISTORY.md)).

If the course has a separate rubric, it should be checked against this list as well.

**Status key**

| Status | Meaning |
|--------|---------|
| **Done (local)** | Built and passing automated tests on my local test setup (real migrations on PGlite and the local Supabase stand-in). Not yet checked on the live site |
| **Done (prod)** | Also checked on the live site, <https://classroom-survey-63r.pages.dev>, either by my manual test or by Claude Code's checks that don't need a login |
| **Unverified (prod)** | Built, but not yet checked on the live site |
| **Partial** | Only partly met. The note explains what is missing |
| **Not done** | Not built or not tested |
| **Manual** | Has to be checked by a person (real phone, projector, spreadsheet app, screenshots) |

## 1. MVP (specification §9)

| Requirement | Status | Evidence / notes |
|-------------|--------|------------------|
| Instructor authentication | Done (local), Done (prod) | Supabase email and password login, and protected pages. On the live site I logged in as the instructor, the login redirect and wrong-password rejection were checked, and public sign-up is off (`disable_signup: true`) |
| Survey creation and editing | Done (local), Done (prod) | `src/pages/SurveyEditor.tsx` and the `save_survey` function. Covered by browser and database tests. I created a survey on the live site |
| Multiple-choice questions | Done (local), Done (prod) | The browser tests create and answer them. Used in my live test |
| True/False questions | Done (local), Done (prod) | Fixed True/False choices; browser tests. Used in my live test |
| QR code generation | Done (local), Done (prod) | The browser tests read the QR code and compare it with the URL on screen. On the live site the present page shows the `pages.dev` address, and I scanned the QR code with my iPhone, which opened the survey |
| Student submission page | Done (local), Done (prod) | `/s/:slug`. On the live site I submitted a response, and opening the link again showed the duplicate message (desktop browser, not a phone) |
| PostgreSQL storage | Done (local), Done (prod) | The migrations are applied on the live project, and my live test response is saved in the `responses` and `answers` tables (screenshot 13) |
| Results dashboard | Done (local), Done (prod) | Counts, percentages, bar charts and Refresh. The example numbers from UI.md are unit-tested. Checked on the live site with 1 response |
| Historical browsing | Done (local), Done (prod) | Dashboard search plus status and date filters. Closed and archived surveys keep their results. On the live site the dashboard showed the survey after closing it |
| CSV export | Done (local), Done (prod) | One row per response with a question-text header, plus `survey_title` and `survey_created_at`. I exported it from the live site and opened it in Excel (web) |

## 2. Users (specification §3)

| Requirement | Status | Evidence / notes |
|-------------|--------|------------------|
| Instructor can create, edit, duplicate, delete and archive | Done (local) | Dashboard buttons with confirmation dialogs; the `duplicate_survey` function. Deleting a survey also deletes its questions and responses (tested) |
| Instructor can activate and close | Done (local) | `activate_survey` and `close_survey` functions |
| Instructor can display QR codes | Done (local) | Present page with a large QR code, a readable URL and a Full Screen button |
| Instructor can view live and past responses | Done (local) | The present page updates the response count every 3 seconds. The results page has a Refresh button. The charts do not update live, but that is listed as a future feature (§10) |
| Instructor can export results | Done (local) | Export CSV button |
| Student can scan, complete and submit | Done (local), Done (prod) | Tested with a QR decoder and a phone-sized browser. On the live site I scanned the QR code with my iPhone, and it opened the survey. Submitting was tested in a desktop browser, not from the phone |
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
| Mobile-friendly layout | Done (local), Manual | Tested at 375 px wide: no sideways scrolling, touch targets at least 44 px, accessibility scan passed. On a real device, the live survey opened on my iPhone from the QR code. Other devices not checked |
| At least 200 students at once | **Not done** | No load test. The design should handle it (static hosting, one database call per submission, a unique index for duplicates), but it has **not been measured** |
| Average page load under 2 seconds | Partial | The student page's JavaScript is 141.7 kB gzipped, and the chart library only loads on the results page. On the live site, one cold load of `/s/zzzzzz` took about 1.6 s in Chrome on one network. This was not measured systematically |
| Secure instructor login | Done | Supabase login, Row Level Security on every table, explicit permissions and no sign-up page. Public sign-up was on at the first check and is now off (`disable_signup: true`). It must stay off, because any signed-in user has full access |
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
| Tables and functions on the live project | Done (prod) | I checked in the Supabase dashboard that all 5 tables and all 7 functions exist. Claude Code confirmed the same with anonymous calls, which also showed the permissions work as designed (TESTING.md) |

## 6. Technology and folder structure (specification §7 and §8)

| Requirement | Status | Notes |
|-------------|--------|-------|
| React, TypeScript, Vite, Tailwind CSS | Done | React 19, TypeScript 7, Vite 8, Tailwind 4 |
| Supabase and PostgreSQL | Done | |
| Recharts and the `qrcode` npm package | Done | |
| Cloudflare Pages | Done | GitHub shows a passing "Cloudflare Pages" check on `main` |
| GitHub | Done | <https://github.com/pr1yanshii/classroom-survey> (public) |
| `src/components`, `src/pages`, `src/lib`, `supabase/`, `public/`, `README.md`, `SPEC.md`, `TODO.md` | Done | `SPEC.md` links to the original specification files |
| ESLint (TODO.md Phase 1) | Partial (on purpose) | oxlint and Prettier are used instead, because `typescript-eslint` doesn't support TypeScript 7 yet (docs/DECISIONS.md #17) |

## 7. Submission items

| Item | Status | Notes |
|------|--------|-------|
| Source code on GitHub | Done | Pushed to `main` up to `5e9f67d`. The latest cleanup (link fixes, screenshot names and these updates) still needs to be committed and pushed |
| The five original specification files | Done | API.md, DATABASE.md, UI.md and the main specification are unchanged. Their file dates are 18:56, before work started, and git shows no changes. In TODO.md only the checkboxes and status notes changed |
| Updated TODO.md | Done | Phases 11 and 15 updated, including my manual live test and the Excel check |
| Database migrations | Done | `supabase/migrations/` |
| README with setup, environment variables, testing and deployment | Done | Includes the live URL and the deployment status |
| docs/DECISIONS.md and TESTING.md | Done | 18 decisions; test results come from real runs |
| No exposed secrets; `.env` files ignored | Done | Every tracked file was checked. Only `.env.example`, which has placeholders, is tracked. The deployed code contains only the public key |
| Public live URL | Done | <https://classroom-survey-63r.pages.dev>. Cloudflare's check passed for `3af973b`, and the live site serves that build |
| Full workflow checked on the live site | Done (by hand) | I tested it in desktop Chrome (see TESTING.md). The automated `npm run test:prod` has not been run |
| DEVELOPMENT_SUMMARY.md | Done | |
| docs/AI_DEVELOPMENT_HISTORY.md | Done | My exact prompts, plus clearly marked summaries |
| Screenshots | Done | 17 of 18 taken, plus 2 extras ([EVIDENCE.md](docs/EVIDENCE.md)). Only the optional #5 wasn't taken. #7 was taken on desktop, not a phone |

## 8. What I still need to do (most important first)

1. ~~Turn off public sign-up.~~ Done: the second check showed `disable_signup: true`.
2. ~~Commit and push the final changes.~~ Done: commit `3af973b`, deployed by Cloudflare.
3. ~~Check the logged-in workflow on the live site.~~ Done by hand (see TESTING.md).
4. ~~Open an exported CSV in a spreadsheet.~~ Done in Excel (web).
5. ~~Finish the screenshots.~~ I'm submitting them as they are (see [EVIDENCE.md](docs/EVIDENCE.md)).
6. ~~Commit and push the cleanup.~~ Done, together with the screenshots.
7. *(Optional)* **More device checks.** ~~Scan the QR code with a phone~~ (done with my iPhone; the
   survey opened). Not done: submitting from a phone, trying an Android phone, and checking the present
   page on the classroom projector.
8. *(Optional)* **Run the automated live tests** (`npm run test:live`, `npm run test:prod`) with
   `.env.test.local`.
9. *(Optional)* **Run a load test** for the 200-student requirement, or leave it listed as a known
   limitation.

## 9. Known limitations (accepted and documented)

- **Duplicate protection works per browser.** A student can submit again from a private window or after
  clearing browser storage. This is the normal trade-off for anonymous surveys.
- **The present page doesn't notice a close made elsewhere.** If the survey is closed in another tab,
  the present page keeps showing the QR code until it is reloaded.
- **Post-MVP features are not built.** Features like live charts, a question bank and LMS integration
  (TODO.md Phase 16, specification §10) are not required.
