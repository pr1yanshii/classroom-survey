# Evidence (Screenshots)

This file lists the screenshots for my submission and whether each one has been taken. I took them
myself on November 5, 2026, and they are in [`docs/screenshots/`](screenshots/). Unless a row says
otherwise, they show the **live site** (<https://classroom-survey-63r.pages.dev>) in desktop Chrome.

**Summary:** 17 of the 18 planned screenshots are done. There are also 4 database screenshots and 2
extra ones. I decided to submit the screenshots as they are.
- **Optional, not taken:** #5 (editor validation).
- **Taken differently than planned:** #7 was taken in a desktop browser instead of on a phone. I did
  scan the QR code with my iPhone (see TESTING.md), but didn't take a screenshot of it.

## Screenshot list

| # | Screenshot | What it shows | File | Status |
|---|------------|---------------|------|--------|
| 1 | Live site home page | Landing page with the `pages.dev` address bar | [01-deployed-landing.png](screenshots/01-deployed-landing.png) | Done |
| 2 | Instructor login page | `/login` with the demo instructor email; the password is hidden | [02-login.png](screenshots/02-login.png) | Done |
| 3 | Instructor dashboard | Dashboard with search and filters and one Active survey | [03-dashboard.png](screenshots/03-dashboard.png) | Done (only one survey shown, not all four statuses; #20 shows a Closed one) |
| 4 | Survey editor | New Survey form with title, description, question type and choices | [04-editor.png](screenshots/04-editor.png) | Done (empty form; #7 shows a Multiple Choice and a True/False question) |
| 5 | Editor validation (optional) | Error messages after saving an empty question | `05-editor-validation.png` | Not taken (optional) |
| 6 | QR presentation page | Title, QR code, `classroom-survey-63r.pages.dev/s/2yvvy3`, response count, buttons | [06-present-qr.png](screenshots/06-present-qr.png) | Done (count is 0, taken before the first response) |
| 7 | Student survey | The survey at `/s/2yvvy3` with one Multiple Choice and one True/False question | [07-student-survey.png](screenshots/07-student-survey.png) | Done in a desktop browser. No phone screenshot, although I tested the phone scan |
| 8 | Student confirmation | "Thank you! Your response has been recorded." | [08-student-thank-you.png](screenshots/08-student-thank-you.png) | Done |
| 9 | Duplicate protection | "You have already submitted a response to this survey." | [09-student-duplicate.png](screenshots/09-student-duplicate.png) | Done |
| 10 | Closed survey message | "This survey is no longer accepting responses." at `/s/2yvvy3` after closing | [10-student-closed.png.png](screenshots/10-student-closed.png.png) | Done |
| 11 | Results page | 1 response, bar chart and table with counts and percentages | [11-results.png](screenshots/11-results.png) | Done |
| 12 | CSV in a spreadsheet | Exported CSV opened in Excel (web), including the `survey_title` and `survey_created_at` columns | [12-csv-spreadsheet.png](screenshots/12-csv-spreadsheet.png) | Done |
| 13 | Supabase tables | Table Editor listing all five tables, with rows in `answers` | [13-supabase-tables.png](screenshots/13-supabase-tables.png) | Done |
| 14 | Supabase Row Level Security | Policies page for all five tables (two screenshots) | [14a-supabase-rls.png](screenshots/14a-supabase-rls.png), [14b-supabase-rls.png](screenshots/14b-supabase-rls.png) | Done |
| 15 | Supabase login settings | Users list, and "Allow new users to sign up" turned **off** | [15a-supabase-users.png](screenshots/15a-supabase-users.png), [15b-supabase-signup-off.png](screenshots/15b-supabase-signup-off.png) | Done (see the privacy note below) |
| 16 | Cloudflare Pages deployment | Production deployments from `main`, latest `5e9f67d`, all successful | [16-cloudflare-deploy.png](screenshots/16-cloudflare-deploy.png) | Done (see the privacy note below) |
| 17 | GitHub repository | Home page of <https://github.com/pr1yanshii/classroom-survey> (public, `main`) | [17-github.png](screenshots/17-github.png) | Done |
| 18 | Automated test results | Terminal: lint (0 warnings, 0 errors), 52/52 Vitest tests, 50/50 Playwright tests, build | [18-tests.png](screenshots/18-tests.png) | Done (the typecheck line is scrolled off the top, but `tsc -b` also runs in the build at the bottom) |

## Extra screenshots

| # | Screenshot | File |
|---|------------|------|
| 19 | "Close Survey" confirmation dialog on the dashboard | [19-close-dialog.png](screenshots/19-close-dialog.png) |
| 20 | Dashboard after closing, showing the Closed status and its buttons | [20-dashboard-closed.png](screenshots/20-dashboard-closed.png) |

## Database records (Supabase)

These show the data saved in Supabase by my live test: the survey, its questions, the student's
response and the answers. Each one is a Supabase Table Editor view of the live project.

| # | Table | What it shows | File |
|---|-------|---------------|------|
| 21 | `surveys` | The "Introduction to Computer Science" survey, with status `closed` and code `2yvvy3` | [21-supabase-surveys.png](screenshots/21-supabase-surveys.png) |
| 22 | `questions` | The survey's two questions: "What does CPU stand for?" (`multiple_choice`) and "HTML is a programming language." (`true_false`) | [22-supabase-questions.png](screenshots/22-supabase-questions.png) |
| 23 | `responses` | The one student response, with its anonymous token and submission time, linked to the survey | [23-supabase-responses.png](screenshots/23-supabase-responses.png) |
| 24 | `answers` | The two answers in that response, one per question, each linked to the chosen choice | [24-supabase-answers.png](screenshots/24-supabase-answers.png) |

## Privacy check

No passwords, secret keys or environment variable values are visible in any screenshot. These
screenshots do show personal details, and the repository is public:

- **`15a-supabase-users.png`** shows my personal email address and both user IDs.
- **`16-cloudflare-deploy.png`** shows part of my Cloudflare login email in the top-left corner.
- **`12-csv-spreadsheet.png`** shows my Microsoft account profile photo in the top-right corner.

I reviewed these and chose to keep the screenshots as they are.
- Screenshots 21–24 show the Supabase project ID in the address bar and my other browser tab titles.
  The project ID is already public, because it is part of the Supabase URL in the live site's code.
- Several screenshots show the demo instructor email (`classroomsurveydemo@gmail.com`). That is the
  demo login, and its password isn't shown.

## Notes

- **Test screenshots aren't evidence.** The browser tests also save screenshots of the local test
  version to `test-results/screenshots/`. Those aren't production evidence, and they aren't in the
  repository.
- **What the screenshots don't show:** my iPhone scan of the QR code (tested, but not captured) and the
  projector view (not tested). See [TESTING.md](../TESTING.md).
