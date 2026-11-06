# Implementation Decisions

Deviations from, or choices left open by, the specification files.

| # | Decision | Reason |
|---|----------|--------|
| 1 | Vite 8 + React 19 + TypeScript 7 (current `create-vite` `react-ts` template). | Spec: React + TS + Vite. |
| 2 | **oxlint** instead of ESLint, plus Prettier. | `typescript-eslint` does not yet support TypeScript 7 (peer range `<6.1`). oxlint ships with the Vite template and runs ESLint-compatible rules (react hooks, TypeScript). |
| 3 | Tailwind CSS v4 via `@tailwindcss/vite`; shared styles (`btn-*`, `input`, `card`) defined with `@utility` in `src/index.css`. | Spec: Tailwind. One place for consistent styling; `min-h-11` gives 44px touch targets (UI.md §7). |
| 4 | React Router (`react-router` package) with a `ProtectedRoute` layout route wrapping all instructor pages. | Routes exactly as UI.md §1. |
| 5 | Schema lives in one migration: `supabase/migrations/20261105000000_initial_schema.sql`. | Matches DATABASE.md, including all "optional/recommended" items (indexes, one-active-survey index, duplicate-token index). |
| 6 | Activation, closing, and student submission use RPCs (`activate_survey`, `close_survey`, `submit_survey_response`). | Recommended by DATABASE.md §9/§11 and API.md §7–10. Atomic, and students never get direct INSERT on `responses`/`answers`. |
| 7 | `submit_survey_response` is `SECURITY DEFINER` and executable by `anon`; activate/close are `SECURITY INVOKER` and executable by `authenticated` only. | Anon must write responses without table access; instructor RPCs stay under RLS. |
| 8 | Public slug: 6 random chars from an unambiguous alphabet (no `0/o/1/l/i`), generated at activation. Route is `/s/:slug`. | DATABASE.md §6 (non-sequential, hard to guess, readable when projected). TODO.md mentions `/s/:surveyId`; UI.md/API.md use `:slug`, so slug wins. |
| 9 | Single-instructor model: any authenticated user has full access. Instructor accounts are created manually in Supabase (no sign-up page). | DATABASE.md §10. Prevents strangers from self-registering. |
| 10 | Editing an Active survey is blocked in the UI and by `save_survey` (`SURVEY_IS_ACTIVE`). Archived surveys are read-only; duplicate to reuse. | TODO.md Phase 5. |
| 11 | Error codes raised by RPCs are mapped to friendly text in `src/lib/errors.ts`. | API.md §10, §13 — no raw DB errors shown to students. |
| 12 | Cloudflare Pages SPA routing via `public/_redirects`. | Spec hosting; deep links like `/s/x7kf2q` must load the app. |
| 13 | `SPEC.md` is an index linking to the five original spec files, which are not modified. | Spec §8 lists `SPEC.md`; originals are preserved. |
| 14 | `TODO.md` is left as provided. Note: many items were already ticked before any code existed; they do not reflect actual progress. | Preserve original spec files. |
| 15 | Second migration `20261105000100_survey_functions.sql` adds `save_survey`, `duplicate_survey`, `survey_choice_counts`, `get_survey_status`, and explicit table grants. | Kept separate so the first migration stays as originally reviewed. |
| 16 | `save_survey` saves the survey, questions and choices atomically and **preserves existing IDs** (updates in place, inserts new, deletes removed). | A delete-and-reinsert approach would cascade-delete recorded answers when a closed survey is edited. |
| 17 | `duplicate_survey` is an RPC (one transaction). | API.md §6 allows app logic or RPC; RPC avoids half-copied surveys. |
| 18 | Results counts come from the `survey_choice_counts` RPC; percentages are computed per question over the answers to that question. | API.md §11 prefers RPC/view. Avoids Supabase's 1000-row limit on raw answer fetches. |
| 19 | `get_survey_status(slug)` (`SECURITY DEFINER`, returns only the status text). | RLS hides non-active surveys from students, so without it the student page couldn't tell "closed" apart from "not found" (UI.md §8). |
| 20 | Explicit grants: `anon` gets only `SELECT` on surveys/questions/choices and no table access to responses/answers; `authenticated` gets full CRUD. | Defense in depth on top of RLS; does not rely on Supabase project defaults. |
| 21 | Present page polls the response count every 3 s. | "Live response count" without needing Supabase Realtime configuration. Realtime remains a post-MVP item (TODO.md Phase 16). |
| 22 | Duplicate protection: random UUID token in `localStorage` + unique DB index on `(survey_id, anonymous_token)`; a local "submitted" flag shows the message immediately on revisit. | TODO.md Phase 8. Anonymous by design, so a student clearing storage or switching browsers can resubmit; this is the accepted limit without student login. |
| 23 | QR code points to `window.location.origin + /s/<slug>`. | QR always matches the deployment you present from (production URL in production). |
| 24 | Instructor pages are lazy-loaded. | Students download ~142 kB gzipped; Recharts (~95 kB gzipped) loads only on the results page. Supports the <2 s load target. |
| 25 | CSV: `response_id, submitted_at, <question text>...` (API.md §12), UTF-8 BOM for Excel, RFC 4180 quoting, and a `'` prefix on cells starting with `= + - @` to block formula injection. Paged fetch so large classes are not truncated. | API.md §12, TODO.md Phase 11. |
| 26 | Activating from the dashboard while another survey is active asks for confirmation; Delete shows a stronger warning with the response count. | UI.md §11. |
| 27 | When Supabase env vars are missing the app shows a setup message instead of a blank page. | Vite inlines env at build time; a missing key otherwise yields an empty bundle. |
| 28 | Tests: Vitest (unit + DB on PGlite with the real migrations), Playwright E2E against a local PGlite-backed Supabase stand-in, and an opt-in live suite. | Docker (needed for `supabase start`) was unavailable; PGlite runs real Postgres so RLS/RPC logic is genuinely exercised. See TESTING.md for what the stand-in does not cover. |
| 29 | oxlint rule `react/set-state-in-effect` disabled. | Flags the standard fetch-on-mount pattern; state is set after `await`. Reviewed in TESTING.md. |
| 30 | Results bars use `minPointSize={2}`. | Without it Recharts omits zero-count bars and their count/percent labels (UI.md §9). |
