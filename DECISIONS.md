# Implementation Decisions

These are the main decisions made while building the Classroom Survey Web App. Each one starts with
the decision in plain words, followed by the technical details that matter for checking or changing
it. Where we went a different way from the specification files, the reason is given.

## 1. Frontend technology

We used React, TypeScript and Vite. The specification (§7) asks for them, and they made the app easy
to split into clear pages and shared pieces.

- React 19, TypeScript 7 and Vite 8, from the current `create-vite` `react-ts` template.
- React Router handles the routes listed in UI.md §1. A `ProtectedRoute` wraps every instructor page,
  so signed-out users are sent to `/login`.
- The instructor pages (dashboard, editor, present, results) are lazy-loaded, which means they are only
  downloaded when opened. Students download about 142 kB of JavaScript (gzipped). The chart library,
  about 95 kB, loads only on the results page. This helps with the under-2-second load target.

## 2. Styling

We used Tailwind CSS to keep the design consistent and make the app work on phones, tablets and
computers.

- Tailwind CSS v4 through `@tailwindcss/vite`, as the specification (§7) asks.
- Shared styles (`btn-*`, `input`, `card`) are defined once with `@utility` in `src/index.css`.
  Tailwind v4 doesn't allow `@apply` with custom class names, so `@utility` is used instead.
- Buttons use `min-h-11`, which gives the 44 px touch targets that UI.md §7 asks for.

## 3. Database

We used Supabase with PostgreSQL, as the specification (§7) asks. It gives us a database and login in
one free service, so there is no custom server.

- The database is defined in two migration files in `supabase/migrations/`, which are run in order:
  - `20261105000000_initial_schema.sql`: the five tables, constraints, indexes, Row Level Security
    policies, and the activate, close and submit functions.
  - `20261105000100_survey_functions.sql`: the save, duplicate, result-count and survey-status
    functions, plus explicit permissions.
- Important actions use database functions (RPCs) instead of separate table writes. Each one runs as a
  single transaction, so it either fully succeeds or changes nothing. DATABASE.md and API.md recommend
  this.
- Error codes from these functions, such as `SURVEY_NOT_ACTIVE` and `DUPLICATE_RESPONSE`, are turned
  into friendly messages in `src/lib/errors.ts`. Students never see raw database errors (API.md §10,
  §13).

## 4. Instructor login

We used Supabase Authentication so the instructor can log in securely with an email and password.

- This is a one-instructor app: any signed-in user has full access, which DATABASE.md §10 allows for a
  single instructor.
- The instructor account is created by hand in the Supabase dashboard. The app has no sign-up page.
- Because any signed-in user gets full access, **public sign-up must be turned off in Supabase**
  (Authentication → Sign In / Providers → Email). It was still on in the first check on November 5,
  2026. It has since been turned off, and the second check confirmed `disable_signup: true`. See
  TESTING.md.

## 5. Student access

Students don't need accounts. They scan a QR code and answer the survey directly, which makes taking
part in class easier.

- The student page is `/s/:slug`. The slug is a 6-character code made when the survey is activated. It
  uses an alphabet without look-alike characters (no `0`, `o`, `1`, `l` or `i`), so it is hard to guess
  and easy to read on a projector (DATABASE.md §6).
- TODO.md mentions `/s/:surveyId`, but UI.md and API.md use a slug, so we followed them.
- Students can only see the active survey. To still show the right message, the `get_survey_status`
  function returns just a survey's status. That lets the student page tell "this survey is closed"
  apart from "survey not found" (UI.md §8).

## 6. Survey management

Instructors can create, edit, duplicate, archive and delete surveys, so they can prepare and reuse
questions.

- `save_survey` saves a survey with all its questions and choices in one transaction. It **keeps
  existing IDs**: it updates rows that already exist, adds new ones and removes deleted ones. The
  simpler "delete everything and add it back" approach would also delete answers already recorded for
  a closed survey.
- An active survey can't be edited; both the editor and `save_survey` block it. Archived surveys are
  read-only, and to reuse one you duplicate it.
- `duplicate_survey` copies the title (as "Copy of …"), the description, the questions and the
  choices in one transaction. It does not copy responses. The copy starts as a Draft.
- Deleting asks for confirmation. If the survey has responses, the dialog says how many will be lost
  and suggests archiving instead.

## 7. Survey status

We used Draft, Active, Closed and Archived statuses to keep surveys organized, as the specification
(§4) asks.

- A database check constraint only allows these four values.
- The dashboard shows the status as a colored badge, which UI.md §4 recommends.

## 8. One active survey

We allow only one active survey at a time, so students are never sent to the wrong survey during class.

- The database enforces this with a partial unique index, `only_one_active_survey`.
- `activate_survey` closes any other active survey before activating the new one.
- If you activate a survey from the dashboard while another one is active, the app asks first and names
  the survey that will be closed.

## 9. QR codes

Each active survey has a QR code that students can scan to open the right survey.

- The QR code is made in the browser with the `qrcode` npm package. It is only shown while the survey
  is active.
- It points to `window.location.origin + /s/<slug>`. That way it always matches the site the instructor
  is presenting from, which is the live URL in production.
- The present page can download the QR code as a PNG and has a Full Screen button.

## 10. Duplicate submissions

We use a browser-generated token and a database rule to reduce repeated submissions from the same
browser. This doesn't fully prevent extra submissions from a different browser or device.

- The token is a random UUID saved in `localStorage`. The database has a unique index on
  `(survey_id, anonymous_token)`, so a second submission with the same token is rejected.
- A "submitted" flag in the browser shows the "already submitted" message right away when a student
  comes back.
- A private window or cleared browser storage gets a new token. This is the accepted limit when
  students stay anonymous.

## 11. Database security

We use Row Level Security to protect survey data and stop anonymous students from reaching
instructor-only data.

- Row Level Security is turned on for all five tables.
- Anonymous users can read only the active survey and its questions and choices. They have no access
  at all to `responses` or `answers`.
- On top of the policies, explicit permissions are set, so the app doesn't depend on Supabase's
  defaults. Anonymous users only get `SELECT` on surveys, questions and choices. Signed-in users get
  full access.
- The functions also have limited permissions:
  - `submit_survey_response` and `get_survey_status` are `SECURITY DEFINER`, so they can do their one
    job without giving students table access. Anonymous users may call them.
  - The instructor functions are `SECURITY INVOKER`, so they still follow Row Level Security, and only
    signed-in users may call them.
- The browser only ever has the public (publishable) key, never the secret `service_role` key.

## 12. Survey responses

Student answers are saved permanently in Supabase, so instructors can look at the results later.

- Every submission goes through `submit_survey_response`. It checks that the survey is active, that
  every question is answered and that each choice belongs to its question. Then it saves the response
  and its answers in one transaction, so a bad submission never leaves half-saved data.
- Closing or archiving a survey keeps its responses. Only deleting a survey removes them.

## 13. Results dashboard

We show answer counts, percentages and charts to make student responses easier to understand.

- Counts come from the `survey_choice_counts` database function. This avoids Supabase's limit of 1000
  rows per request.
- Each percentage is the share of the answers to that question, rounded to one decimal place.
- Charts use Recharts with `minPointSize={2}`. Without it, choices with 0 answers had no bar and no
  count or percentage label, which UI.md §9 requires.
- The results page has a Refresh button. It doesn't update by itself.

## 14. Live response count

The present page checks for new responses every 3 seconds, so the instructor can watch participation.

- This polling gives a live count without setting up Supabase Realtime. Realtime is a post-MVP item
  (TODO.md Phase 16).
- Only the count is live. If the survey is closed from another tab, the present page keeps showing the
  QR code until it is reloaded.

## 15. CSV export

We added CSV export so instructors can download the survey responses and open them in a spreadsheet.

- **Layout:** one row per response, with the columns `response_id`, `submitted_at`, one column per
  question, then `survey_title` and `survey_created_at`. The header row uses the question text, as
  API.md §12 recommends.
- **Survey metadata:** the title and date columns are added at the end, which TODO.md Phase 11 asks
  for. That keeps API.md's recommended layout. Putting metadata rows above the header would break its
  "first row contains question text" rule.
- **Spreadsheet safety:**
  - The file starts with a UTF-8 BOM, so Excel shows special characters correctly.
  - Values are quoted the standard way (RFC 4180).
  - Cells that start with `=`, `+`, `-` or `@` get a `'` in front, so a spreadsheet won't run them as
    formulas.
- **Large classes:** data is loaded in pages of 1000 rows, so big classes aren't cut off.
- **Not yet tested in a spreadsheet:** the file has not been opened in Excel or Google Sheets yet. Only
  the file format was tested.

## 16. Deployment

We used Cloudflare Pages because it is free and the specification (§7) names it as the hosting
service.

- Cloudflare builds the site from GitHub on every push to `main`, using `npm run build` and the `dist`
  folder. `.node-version` sets Node 24.
- `public/_redirects` sends every path to `index.html`, so direct links like `/s/abc234` load the app.
- **Supabase settings:**
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Cloudflare. Vite puts them into the
    code at build time, so they must be set where the app is built.
  - If they are missing, the app shows a "Supabase is not configured" message instead of a blank page.
  - `.env.local` is ignored by git, and only `.env.example`, which has placeholders, is in the
    repository.

## 17. Testing

We used automated tests to check the app, the database rules and the main user workflows. Real-device
testing and load testing still need to be done.

- **Unit and database tests (Vitest):** the database tests run the real migration files on PGlite,
  which is PostgreSQL that runs inside Node, with Supabase's `anon` and `authenticated` roles
  recreated. We used PGlite because Docker, which the usual `supabase start` setup needs, wasn't
  available. This way the security rules and functions are really tested.
- **Browser tests (Playwright, Chrome and Firefox):** these run against a small local stand-in for
  Supabase built on PGlite. Safari isn't tested, because Playwright's Safari engine wouldn't start on
  macOS 14.
- **Optional live tests:** two more test sets check the live Supabase project (`npm run test:live`) and
  the deployed site (`npm run test:prod`). They need the instructor login, so they have not been run
  yet.
- **Code checks:**
  - We used oxlint and Prettier instead of the ESLint setup in TODO.md Phase 1, because
    `typescript-eslint` doesn't support TypeScript 7 yet.
  - The oxlint rule `react/set-state-in-effect` is turned off. It flags the normal "load data when the
    page opens" pattern. The reasoning is in TESTING.md (bug #3).

## 18. Future improvements

Possible improvements include live-updating charts, support for more than one instructor, and stronger
duplicate-submission protection.

- Live-updating charts and multiple instructors are listed as future enhancements in the specification
  (§10) and in TODO.md Phase 16.
- Stronger duplicate protection would need students to log in. The specification also lists student
  authentication as a future enhancement.

## Notes on the specification files

- The professor's specification files are kept unchanged and are the source of truth. `SPEC.md` is a
  short index that links to them, because the specification's folder structure (§8) lists a `SPEC.md`.
- In `TODO.md`, the task wording is unchanged. Many boxes were already ticked before any code existed,
  so from the testing stage on, the checkboxes were corrected to match what is actually built and
  tested, and short status notes were added.
