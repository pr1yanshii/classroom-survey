# Classroom Survey Web App — TODO

## Purpose

This roadmap breaks the implementation into small, testable phases ordered from foundational work to advanced features.

> **Status notes (added by me, November 5, 2026, for the final submission).** The task wording below
> is unchanged; I only updated the checkboxes and added short notes in parentheses.
>
> - `[x]` means the item is built and passed the automated tests described in [TESTING.md](TESTING.md).
> - "local" means it was tested on my local setup (the real migrations on PGlite, plus a local
>   stand-in for Supabase) but **not yet on the live Supabase project**.
> - The live project has the migrations applied (checked without logging in). The logged-in instructor
>   features have not been tested there yet.

---

# Phase 1 — Project Setup

- [x] Create a new React + TypeScript project with Vite.
- [x] Add Tailwind CSS.
- [x] Add React Router.
- [x] Add Supabase JavaScript client.
- [x] Add Recharts.
- [x] Add QR code generation package.
- [x] Create the initial project folder structure.
- [x] Add `.env.example` with Supabase environment variable names.
- [x] Configure ESLint and formatting. _(oxlint + Prettier, because typescript-eslint doesn't support TypeScript 7; see DECISIONS.md #17)_
- [x] Create a basic home page.
- [x] Verify the project builds successfully.

---

# Phase 2 — Supabase Project and Database

- [x] Create a Supabase project. _(migrations applied; confirmed without logging in)_
- [x] Create the `surveys` table. _(in migrations; local)_
- [x] Create the `questions` table. _(in migrations; local)_
- [x] Create the `choices` table. _(in migrations; local)_
- [x] Create the `responses` table. _(in migrations; local)_
- [x] Create the `answers` table. _(in migrations; local)_
- [x] Add foreign-key constraints. _(local)_
- [x] Add database indexes. _(local)_
- [x] Add timestamps. _(local)_
- [x] Add survey-status validation. _(local)_
- [x] Create Row Level Security policies. _(local)_
- [x] Verify students cannot read survey results. _(local; live check: `npm run test:live`)_
- [x] Verify anonymous students can read active surveys. _(local; live check: `npm run test:live`)_
- [x] Verify anonymous students can submit responses. _(local; live check: `npm run test:live`)_
- [x] Verify authenticated instructors have full access. _(local; live check: `npm run test:live`)_

---

# Phase 3 — Instructor Authentication

- [x] Create the instructor login page.
- [x] Connect login to Supabase Auth.
- [x] Add logout.
- [x] Create an authentication context/provider.
- [x] Create a protected-route component.
- [x] Redirect unauthenticated users to login.
- [x] Show the logged-in instructor in the dashboard.

---

# Phase 4 — Instructor Dashboard

- [x] Create the dashboard layout.
- [x] Load surveys from Supabase.
- [x] Display survey title, status, and creation date.
- [x] Add status badges for Draft, Active, Closed, and Archived.
- [x] Add a New Survey button.
- [x] Add Edit action.
- [x] Add Duplicate action.
- [x] Add Delete action.
- [x] Add Archive action.
- [x] Add View Results action.
- [x] Add Activate action.
- [x] Add Close action.
- [x] Add search by survey title.
- [x] Add filtering by status.

---

# Phase 5 — Survey Editor

- [x] Create a survey editor page.
- [x] Add survey title field.
- [x] Add optional description field.
- [x] Add questions dynamically.
- [x] Support Multiple Choice questions.
- [x] Support True / False questions.
- [x] Add answer choices dynamically.
- [x] Reorder questions.
- [x] Reorder choices.
- [x] Delete questions.
- [x] Delete choices.
- [x] Validate required fields.
- [x] Save a survey as Draft.
- [x] Load an existing survey for editing.
- [x] Prevent editing an active survey unless it is first closed.

---

# Phase 6 — Survey Activation

- [x] Add activation logic.
- [x] Ensure at most one survey is Active.
- [x] Automatically close the previously active survey.
- [x] Generate a public survey slug or identifier.
- [x] Generate the public survey URL.
- [x] Generate a QR code from the public URL.
- [x] Create a Present Survey page.
- [x] Display survey title and QR code.
- [x] Display a readable fallback URL.
- [x] Add a Close Survey button.
- [x] Add a Download QR Code button.

---

# Phase 7 — Student Survey Page

- [x] Create the public route `/s/:surveyId`.
- [x] Load the requested active survey.
- [x] Show an error if the survey does not exist.
- [x] Show a message if the survey is closed.
- [x] Render survey title and description.
- [x] Render Multiple Choice questions.
- [x] Render True / False questions.
- [x] Validate required answers.
- [x] Add Submit button.
- [x] Store response and answers in Supabase.
- [x] Show a submission confirmation page.
- [x] Make the entire experience mobile friendly.

---

# Phase 8 — Duplicate Submission Protection

- [x] Generate an anonymous browser token.
- [x] Store the token in local storage.
- [x] Save the token with each response.
- [x] Prevent the same token from submitting twice to the same survey.
- [x] Show a friendly message if a duplicate submission is attempted.
- [x] Add a database uniqueness constraint if appropriate.

---

# Phase 9 — Results Dashboard

- [x] Create a results page for each survey.
- [x] Show total response count.
- [x] Aggregate answers by question.
- [x] Show counts for each choice.
- [x] Show percentages for each choice.
- [x] Add bar charts using Recharts.
- [x] Clearly label unanswered questions.
- [x] Add Refresh Results button.
- [x] Add link back to the main dashboard.

---

# Phase 10 — Historical Results

- [x] Allow viewing results for Closed surveys.
- [x] Allow viewing results for Archived surveys.
- [x] Add filtering by date.
- [x] Add filtering by survey title.
- [x] Preserve all historical response data.

---

# Phase 11 — CSV Export

- [x] Add Export CSV button.
- [x] Export survey metadata. _(`survey_title`, `survey_created_at` columns; local)_
- [x] Export one row per response.
- [x] Include submission timestamp.
- [x] Include each question and answer.
- [x] Create safe CSV escaping.
- [ ] Test export with spreadsheet applications. _(file format tested; not yet opened in Excel or Google Sheets)_

---

# Phase 12 — Survey Duplication

- [x] Duplicate survey title and description.
- [x] Duplicate questions.
- [x] Duplicate answer choices.
- [x] Create the copy in Draft state.
- [x] Add "Copy of ..." naming.
- [x] Redirect to the editor after duplication.

---

# Phase 13 — UI Polish

- [x] Add consistent page layouts.
- [x] Improve mobile responsiveness.
- [x] Add loading states.
- [x] Add empty states.
- [x] Add error messages.
- [x] Add confirmation dialogs for destructive actions.
- [x] Improve QR-code presentation for classroom projection.
- [x] Test accessibility and keyboard navigation. _(axe scan on 6 pages, plus submitting with the keyboard only)_
- [x] Improve color contrast.

---

# Phase 14 — Testing

- [x] Test instructor login. _(local)_
- [x] Test survey creation. _(local)_
- [x] Test survey editing. _(local)_
- [x] Test activation. _(local)_
- [x] Test closing surveys. _(local)_
- [x] Test QR-code links. _(QR read by software; not yet scanned with a phone)_
- [x] Test student submissions. _(local)_
- [x] Test duplicate-submission prevention. _(local)_
- [x] Test results calculations. _(local)_
- [x] Test CSV export. _(local)_
- [x] Test mobile layout. _(Chrome device emulation; no real phone yet)_
- [x] Test with at least two browsers. _(Chrome + Firefox; Safari/iOS not tested)_
- [x] Test unauthorized access attempts. _(local)_
- [x] Test database Row Level Security. _(local; live pending)_

---

# Phase 15 — Deployment

- [x] Push the project to GitHub. _(https://github.com/pr1yanshii/classroom-survey, public)_
- [x] Create the Cloudflare Pages site. _(https://classroom-survey-63r.pages.dev)_
- [x] Connect Cloudflare Pages to the GitHub repository. _(GitHub shows a passing "Cloudflare Pages" check on `main`)_
- [x] Configure production environment variables. _(the deployed site uses the project URL and public key; no secret key)_
- [x] Deploy the application.
- [x] Configure SPA routing. _(the direct link `/s/zzzzzz` loads and shows "Survey not found.")_
- [ ] Verify production login. _(wrong password is rejected and protected pages redirect to login; a real instructor login is not checked yet)_
- [ ] Verify QR codes point to the production URL.
- [ ] Test student submissions in production.
- [ ] Test instructor results in production.

---

# Phase 16 — Post-MVP Enhancements

- [ ] Add live updating results with Supabase Realtime.
- [ ] Add question bank.
- [ ] Add survey import/export as JSON.
- [ ] Add Markdown import.
- [ ] Add short-answer questions.
- [ ] Add checkbox questions.
- [ ] Add rating-scale questions.
- [ ] Add numeric questions.
- [ ] Add AI-assisted question generation.
- [ ] Add LMS integration.
- [ ] Add multiple instructors.
- [ ] Add course and semester organization.
- [ ] Add analytics across multiple surveys.
