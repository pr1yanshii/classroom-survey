# Evidence (Screenshots)

This file lists the screenshots for my submission and whether each one has been taken.

**Status on November 5, 2026: none of the screenshots below have been taken yet. I need to take all of
them myself.** They will go in `docs/screenshots/` with the file names listed. When one is taken, I'll
change its status to "Captured".

## Screenshots that already exist (not production evidence)

The browser tests (`npm run test:e2e`) save six screenshots to `test-results/screenshots/`:

- `dashboard-desktop.png`
- `dashboard-mobile.png`
- `editor-desktop.png`
- `present-desktop.png`
- `results-desktop.png`
- `student-mobile.png`

These show the **local test version** of the app with test data, not the live site or my real
database. The `test-results/` folder is ignored by git and gets replaced every time the tests run, so
these files are not in the repository. They are only a preview of what to capture.

## Screenshots to take

Unless the row says otherwise, take each one on the **live site**
(<https://classroom-survey-63r.pages.dev>) with the browser address bar visible.

| # | Screenshot | How to get it | File name | Status |
|---|------------|---------------|-----------|--------|
| 1 | Live site home page | Open the live URL with the address bar visible | `01-deployed-landing.png` | Not taken |
| 2 | Instructor login page | Go to `/login` | `02-login.png` | Not taken |
| 3 | Instructor dashboard | Log in. Show several surveys with different statuses (Draft, Active, Closed, Archived) | `03-dashboard.png` | Not taken |
| 4 | Survey editor | Edit a survey with one Multiple Choice and one True/False question | `04-editor.png` | Not taken |
| 5 | Editor validation (optional) | Click Save with an empty question so the error messages show | `05-editor-validation.png` | Not taken |
| 6 | QR presentation page | Click Save & Activate. Show the title, QR code, `pages.dev` URL and a response count above 0 | `06-present-qr.png` | Not taken |
| 7 | Student survey on a real phone | Scan the projected QR code with a phone camera and screenshot the phone | `07-student-phone.png` | Not taken |
| 8 | Student confirmation | The phone after pressing Submit ("Thank you!") | `08-student-thank-you.png` | Not taken |
| 9 | Duplicate protection | Open the same link again on the same phone ("already submitted") | `09-student-duplicate.png` | Not taken |
| 10 | Closed survey message | Close the survey, then reload the student link ("no longer accepting responses") | `10-student-closed.png` | Not taken |
| 11 | Results page | Counts, percentages and bar charts for a survey with several responses | `11-results.png` | Not taken |
| 12 | CSV in a spreadsheet | Export the CSV and open it in Excel or Google Sheets. It should show the question columns plus `survey_title` and `survey_created_at`. See the note below | `12-csv-spreadsheet.png` | Not taken |
| 13 | Supabase tables | Table Editor showing all five tables: `surveys`, `questions`, `choices`, `responses`, `answers`. Use one screenshot of the list, or one per table with rows | `13-supabase-tables.png` (or `13a`–`13e`) | Not taken |
| 14 | Supabase Row Level Security | Authentication → Policies (or Database → Policies), showing RLS turned on with policies for all five tables | `14-supabase-rls.png` | Not taken |
| 15 | Supabase login settings | The Users list with the instructor account, and the Email provider with "Allow new users to sign up" **off** | `15-supabase-auth.png` | Not taken |
| 16 | Cloudflare Pages deployment | The project page showing a successful production deployment from `main` | `16-cloudflare-deploy.png` | Not taken |
| 17 | GitHub repository | The home page of <https://github.com/pr1yanshii/classroom-survey> | `17-github-repo.png` | Not taken |
| 18 | Automated test results | Terminal output of `npm test` and `npm run test:e2e`, plus `npm run test:prod` if it has been run | `18-tests.png` | Not taken |

**Note on row 12:** the new CSV columns are in my local copy but not on the live site yet. The live site
will only have them after I push and Cloudflare rebuilds the site. Until then it exports the older CSV
without them.

## Before taking the screenshots

- **Keep secrets out.** Never show the Supabase secret (`service_role`) key, the database password or
  my instructor password. The public (publishable) key is safe to share, but I'll crop it out anyway.
  In Cloudflare, show that the environment variables exist, not their values.
- **Use test data.** Use realistic survey questions with no real student names. The app doesn't
  collect names anyway.
- **Use the live URL.** The QR page must show the `pages.dev` address, because that proves the QR code
  points to the live site.
- **Fix the sign-up setting first.** Row 15 should show sign-up turned **off**. On November 5, 2026 it
  was still on (see [TESTING.md](TESTING.md)).
