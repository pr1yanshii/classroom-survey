# Classroom Survey

A web app for quick in-class understanding checks. The instructor prepares a survey, activates it,
and projects a QR code. Students scan it and answer on their phones without logging in. Responses
are stored permanently and shown as counts, percentages, and bar charts, with CSV export.

CSE 4095 project.

- **Live app:** _added after deployment is verified_
- **Specification (unchanged, source of truth):**
  [Classroom_Survey_Web_App_Specification.md](Classroom_Survey_Web_App_Specification.md),
  [DATABASE.md](DATABASE.md), [API.md](API.md), [UI.md](UI.md), [TODO.md](TODO.md) (progress updated).
  Index: [SPEC.md](SPEC.md)
- **Design decisions:** [DECISIONS.md](DECISIONS.md)
- **Test results and known limitations:** [TESTING.md](TESTING.md)

## Features

**Instructor** (Supabase Auth email/password)

- Create, edit, duplicate, archive, and delete surveys
- Multiple Choice and True/False questions; reorder questions and choices
- Activate / close surveys; only one survey can be active (enforced by the database)
- Present page: large QR code, readable URL, PNG download, live response count, full-screen mode
- Results: total responses, per-choice counts and percentages, bar charts, refresh
- Historical browsing: search by title, filter by status and creation date
- CSV export (one row per response)

**Student** (no account)

- Opens `/s/<code>` from the QR code; mobile-first, one column, 44 px+ touch targets
- Validation, confirmation, and friendly messages for closed / unknown surveys
- Duplicate protection: browser token + database uniqueness constraint

**Security**

- Row Level Security on all five tables; students can read only the active survey and cannot read
  any responses
- Submissions go through one validated, transactional database function
- Only the public (anon / publishable) Supabase key is used in the browser

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
  unit/  db/  e2e/  live/   See TESTING.md
public/         favicon, Cloudflare `_redirects` (SPA routing)
```

| Path | Page | Access |
|------|------|--------|
| `/` | Landing | Public |
| `/login` | Instructor login | Public |
| `/s/:slug` | Student survey | Public |
| `/dashboard` | Survey list | Instructor |
| `/surveys/new`, `/surveys/:id/edit` | Survey editor | Instructor |
| `/surveys/:id/present` | QR code for projection | Instructor |
| `/surveys/:id/results` | Charts and CSV export | Instructor |

## 1. Install

Requirements: Node.js 22.12+ (24 recommended; see `.node-version`) and npm.

```sh
git clone https://github.com/<your-account>/classroom-survey.git
cd classroom-survey
npm install
```

## 2. Supabase setup (free tier)

1. Create a project at <https://supabase.com/dashboard> → **New project**.
2. **SQL Editor → New query**: paste and **Run** each migration, in this order:
   1. `supabase/migrations/20261105000000_initial_schema.sql`
   2. `supabase/migrations/20261105000100_survey_functions.sql`

   Each should report "Success. No rows returned". (With the Supabase CLI you can instead run
   `supabase link` then `supabase db push`.)
3. **Authentication → Users → Add user → Create new user**: enter the instructor's email and
   password and tick **Auto Confirm User**.
4. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up", so
   only the account from step 3 can log in.
5. **Project Settings → API Keys**: copy the **Publishable key** (or the legacy **anon public**
   key). **Project Settings → Data API** (or **API**): copy the **Project URL**.

> Never use the `service_role` / secret key in this app. It bypasses Row Level Security and would be
> visible to anyone who opens the site.

## 3. Environment variables

| Variable | Value | Secret? |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` | No |
| `VITE_SUPABASE_ANON_KEY` | Publishable / anon key | No: public by design; RLS protects the data |

Local development:

```sh
cp .env.example .env.local   # then fill in both values
```

`.env.local` and every other `.env*` file except `.env.example` are git-ignored. Vite embeds these
values in the JavaScript bundle at build time, so they must be set wherever the app is **built**.

## 4. Run locally

```sh
npm run dev        # http://localhost:5173
```

If the variables are missing, the app shows a "Supabase is not configured" message.

## 5. Testing

| Command | What it runs |
|---------|--------------|
| `npm run typecheck` | TypeScript (app, config, tests) |
| `npm run lint` | oxlint |
| `npm test` | Unit tests + database tests on PGlite (real Postgres running the migrations) |
| `npm run test:e2e` | Browser tests in Chrome and Firefox against a local Supabase stand-in. One-time: `npx playwright install firefox` (Chrome must be installed) |
| `npm run test:live` | Tests against your real Supabase project (see below) |
| `npm run test:prod` | Full browser workflow against the **deployed** site (see §6) |
| `npm run build` | Typecheck and production build to `dist/` |

Live test (creates one "[live test]" survey and deletes it; re-activates whatever survey was active):

```sh
LIVE_EMAIL=you@example.com LIVE_PASSWORD='your-password' npm run test:live
```

Results, coverage, bugs fixed, and limitations: [TESTING.md](TESTING.md).

## 6. Deploy to Cloudflare Pages (free)

The site is static; Cloudflare builds it from GitHub on every push.

1. Push this repository to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**. Authorize the
   Cloudflare GitHub app and pick the repository.
3. Build settings:

   | Setting | Value |
   |---------|-------|
   | Framework preset | None (or Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | _(leave empty)_ |

4. **Environment variables (advanced)** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for
   **Production** (and Preview if you use preview branches). Node 24 is selected automatically from
   `.node-version`.
5. **Save and Deploy**. The site is published at `https://<project-name>.pages.dev`.
6. If you change the variables later, use **Deployments → Retry deployment** so the bundle is rebuilt.

SPA routing: `public/_redirects` sends every path to `index.html`, so deep links such as
`/s/abc234` and `/dashboard` load the app. QR codes use the address the instructor is presenting
from, so present from the production URL.

### Verify production

Automated: create a git-ignored `.env.test.local` with `PROD_URL=https://<project>.pages.dev`,
`LIVE_EMAIL=...`, `LIVE_PASSWORD=...`, then run `npm run test:prod`. It logs in, creates a
"[prod check]" survey, activates it, decodes the QR code, submits as two phone users, checks
duplicate blocking, the live count, results, CSV, and closing, then deletes the survey. Manual
checklist:

- [ ] `https://<project>.pages.dev/s/zzzzzz` shows "Survey not found." (SPA routing + Supabase reachable)
- [ ] Instructor login works; wrong password is rejected
- [ ] Create a survey, **Save & Activate**; the QR code and URL show the production domain
- [ ] Scan the QR code with a phone, submit; the present page count goes up
- [ ] Submitting again from the same phone shows "already submitted"
- [ ] Results show correct counts and percentages; CSV downloads
- [ ] Close the survey; the student link shows "no longer accepting responses"

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Supabase is not configured" | Env vars missing at build time; set them and rebuild/redeploy |
| "Something went wrong" everywhere, or 404s from `/rest/v1/...` | Migrations not run, or run out of order |
| Login fails with correct password | User not confirmed: tick **Auto Confirm User** or confirm in Authentication → Users |
| Students see "Survey not found" | The survey is not active, or the URL code is mistyped |
| Deep links 404 on the host | Ensure `public/_redirects` is deployed (Cloudflare) or configure an SPA fallback |
