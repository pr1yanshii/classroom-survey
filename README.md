# Classroom Survey

A web app for quick understanding checks during class. The instructor prepares a survey, activates it
and projects a QR code. Students scan the code and answer on their phones without logging in.
Responses are saved permanently and shown as counts, percentages and bar charts. They can also be
exported as CSV.

This is my CSE 4095 project.

- **Live app:** <https://classroom-survey-63r.pages.dev> (Cloudflare Pages, deployed from `main`)
- **Source code:** <https://github.com/pr1yanshii/classroom-survey>
- **Specification:** the professor's files are the source of truth and are unchanged:
  [Classroom_Survey_Web_App_Specification.md](Classroom_Survey_Web_App_Specification.md),
  [DATABASE.md](DATABASE.md), [API.md](API.md), [UI.md](UI.md) and [TODO.md](TODO.md). In TODO.md,
  only the progress checkboxes and notes are updated. [SPEC.md](SPEC.md) links to all five.
- **Design decisions:** [DECISIONS.md](docs/DECISIONS.md)
- **Test results and known limitations:** [TESTING.md](TESTING.md)
- **Submission documents:**
  - [DEVELOPMENT_SUMMARY.md](DEVELOPMENT_SUMMARY.md)
  - [AI_DEVELOPMENT_HISTORY.md](docs/AI_DEVELOPMENT_HISTORY.md)
  - [EVIDENCE.md](docs/EVIDENCE.md) (screenshots)
  - [FINAL_SUBMISSION_CHECKLIST.md](FINAL_SUBMISSION_CHECKLIST.md)

**Deployment status (November 5, 2026):** the site is live.
- I tested the full workflow on it by hand in desktop Chrome: login, creating and activating a survey,
  the QR page, submitting, duplicate blocking, results, CSV export (opened in Excel) and closing.
- Claude Code also checked the parts that don't need a login.
- The automated live tests (`npm run test:live`, `npm run test:prod`) have not been run.
- I also scanned the QR code with my iPhone, and it opened the live survey. I didn't submit from the
  phone.
- Still untested: submitting from a phone, other phones, a projector check and a load test.

See [TESTING.md](TESTING.md#production-checks-that-did-run-anonymous-no-credentials) and the
screenshots in [docs/EVIDENCE.md](docs/EVIDENCE.md).

## Features

**Instructor** (logs in with email and password through Supabase Auth)

- Create, edit, duplicate, archive and delete surveys.
- Multiple Choice and True/False questions. Questions and choices can be reordered.
- Activate and close surveys. Only one survey can be active, and the database enforces this.
- Present page with a large QR code, a readable URL, PNG download, a live response count and full-screen
  mode.
- Results page with the total number of responses, counts and percentages for each choice, bar charts
  and a Refresh button.
- Past surveys: search by title and filter by status or creation date.
- CSV export with one row per response. The columns are `response_id`, `submitted_at`, one column per
  question, then `survey_title` and `survey_created_at`.

**Student** (no account needed)

- Opens `/s/<code>` from the QR code. The page is built for phones first: a single column with touch
  targets of at least 44 px.
- Gets clear validation, a confirmation screen, and friendly messages when a survey is closed or the
  link is wrong.
- Can't submit twice: a random token saved in the browser, plus a uniqueness rule in the database.

**Security**

- Row Level Security is on for all five tables. Students can read only the active survey, and can never
  read any responses.
- Every submission goes through one database function that checks it and saves everything at once.
- The browser only ever uses the public Supabase key (anon or publishable).

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Supabase (PostgreSQL + Auth) ·
Recharts · qrcode · Cloudflare Pages · Vitest · Playwright

## Project structure

```text
src/
  pages/        One component per route (UI.md §1)
  components/   Shared UI (layout, ProtectedRoute, ConfirmDialog, StatusBadge, ...)
  lib/          Supabase client, data access (api.ts), auth, results/CSV logic, types
supabase/
  migrations/   Tables, constraints, indexes, RLS policies, RPC functions (run in order)
tests/
  unit/  db/  e2e/  live/  prod/   See TESTING.md
public/         favicon, Cloudflare `_redirects` (SPA routing)
docs/           DECISIONS, AI development history, EVIDENCE, screenshots/
```

| Path | Page | Who can open it |
|------|------|-----------------|
| `/` | Landing | Anyone |
| `/login` | Instructor login | Anyone |
| `/s/:slug` | Student survey | Anyone |
| `/dashboard` | Survey list | Instructor |
| `/surveys/new`, `/surveys/:id/edit` | Survey editor | Instructor |
| `/surveys/:id/present` | QR code for projecting | Instructor |
| `/surveys/:id/results` | Charts and CSV export | Instructor |

## 1. Install

You need Node.js 22.12 or newer (24 is recommended; see `.node-version`) and npm.

```sh
git clone https://github.com/<your-account>/classroom-survey.git
cd classroom-survey
npm install
```

## 2. Set up Supabase (free tier)

1. Create a project at <https://supabase.com/dashboard> → **New project**.
2. Open **SQL Editor → New query**. Paste in each migration and click **Run**, in this order:
   1. `supabase/migrations/20261105000000_initial_schema.sql`
   2. `supabase/migrations/20261105000100_survey_functions.sql`

   Each one should say "Success. No rows returned". If you use the Supabase CLI, you can run
   `supabase link` and then `supabase db push` instead.
3. Go to **Authentication → Users → Add user → Create new user**. Enter the instructor's email and
   password, and tick **Auto Confirm User**.
4. Go to **Authentication → Sign In / Providers → Email** and turn **off** "Allow new users to sign
   up". That way only the account from step 3 can log in.
5. Go to **Project Settings → API Keys** and copy the **Publishable key** (or the older **anon public**
   key). Then go to **Project Settings → Data API** (or **API**) and copy the **Project URL**.

> Never use the `service_role` or secret key in this app. It skips Row Level Security, and anyone who
> opens the site would be able to see it.

## 3. Environment variables

| Variable | Value | Secret? |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Project URL, for example `https://abcd1234.supabase.co` | No |
| `VITE_SUPABASE_ANON_KEY` | Publishable or anon key | No. It is meant to be public; Row Level Security protects the data |

For local development:

```sh
cp .env.example .env.local   # then fill in both values
```

Git ignores `.env.local` and every other `.env*` file except `.env.example`. Vite puts these values
into the JavaScript when the app is built. So they must be set wherever the app is **built**, not just
where it runs.

## 4. Run locally

```sh
npm run dev        # http://localhost:5173
```

If the variables are missing, the app shows a "Supabase is not configured" message.

## 5. Testing

| Command | What it does |
|---------|--------------|
| `npm run typecheck` | Checks TypeScript types in the app, config and tests |
| `npm run lint` | Runs oxlint |
| `npm test` | Unit tests, plus database tests that run the real migrations on PGlite (PostgreSQL running inside Node) |
| `npm run test:e2e` | Browser tests in Chrome and Firefox against a local stand-in for Supabase. First time only: `npx playwright install firefox`. Chrome must already be installed |
| `npm run test:live` | Tests against your real Supabase project (see below) |
| `npm run test:prod` | Full browser workflow against the **deployed** site (see §6) |
| `npm run build` | Type check, then a production build into `dist/` |

The live test creates one "[live test]" survey and deletes it afterwards. If a survey was active
before, it is activated again at the end.

```sh
LIVE_EMAIL=you@example.com LIVE_PASSWORD='your-password' npm run test:live
```

Test results, coverage, fixed bugs and limitations are in [TESTING.md](TESTING.md).

## 6. Deploy to Cloudflare Pages (free)

The site is static, and Cloudflare rebuilds it from GitHub on every push.

1. Push this repository to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**. Authorize
   the Cloudflare GitHub app and pick the repository.
3. Use these build settings:

   | Setting | Value |
   |---------|-------|
   | Framework preset | None (or Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | _(leave empty)_ |

4. Under **Environment variables (advanced)**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for
   **Production**. Add them for Preview too if you use preview branches. Cloudflare picks Node 24
   automatically from `.node-version`.
5. Click **Save and Deploy**. The site is published at `https://<project-name>.pages.dev`. For this
   project, that is <https://classroom-survey-63r.pages.dev>.
6. If you change the variables later, use **Deployments → Retry deployment** so the site is rebuilt
   with the new values.

**Deep links:** `public/_redirects` sends every path to `index.html`. That way, links like `/s/abc234`
and `/dashboard` load the app. The QR code uses whatever address the instructor is presenting from, so
present from the live URL.

### Check the live site

**Automated check:**
1. Create a `.env.test.local` file (git ignores it) with `PROD_URL=https://<project>.pages.dev`,
   `LIVE_EMAIL=...` and `LIVE_PASSWORD=...`.
2. Run `npm run test:prod`.

The test logs in and creates a "[prod check]" survey, activates it and reads the QR code. Then it
submits as two phone users and checks duplicate blocking, the live count, the results, the CSV and
closing. Finally, it deletes the survey.

**Manual checklist:**

- [ ] `https://<project>.pages.dev/s/zzzzzz` shows "Survey not found." (deep links work and Supabase is reachable)
- [ ] Instructor login works, and a wrong password is rejected
- [ ] Create a survey and click **Save & Activate**; the QR code and URL show the live domain
- [ ] Scan the QR code with a phone and submit; the count on the present page goes up
- [ ] Submitting again from the same phone shows "already submitted"
- [ ] The results show the right counts and percentages, and the CSV downloads
- [ ] Close the survey; the student link shows "no longer accepting responses"

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Supabase is not configured" | The environment variables were missing at build time. Set them and rebuild or redeploy |
| "Something went wrong" everywhere, or 404 errors from `/rest/v1/...` | The migrations were not run, or were run in the wrong order |
| Login fails with the correct password | The user isn't confirmed. Tick **Auto Confirm User**, or confirm the user in Authentication → Users |
| Students see "Survey not found" | The survey isn't active, or the code in the URL is mistyped |
| Strangers could register as instructors | Go to Authentication → Sign In / Providers → Email and turn off "Allow new users to sign up". Any signed-in user has full access |
| Deep links show a 404 page | Make sure `public/_redirects` is deployed (on Cloudflare), or set up an SPA fallback on your host |
