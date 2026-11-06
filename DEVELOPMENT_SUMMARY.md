# Development Summary

**Project:** Classroom Survey Web App (CSE 4095)
**Live app:** <https://classroom-survey-63r.pages.dev>
**Repository:** <https://github.com/pr1yanshii/classroom-survey>

## The project

I built a web app that helps an instructor check whether students understand the material during
class:
- The instructor writes a short survey with multiple-choice and true/false questions, activates it
  with one click, and projects a QR code.
- Students scan the code and answer on their phones without an account.
- Responses are saved permanently. The instructor sees counts, percentages and bar charts, and can
  export the results as CSV.
- Old surveys stay on the dashboard, where they can be searched, duplicated, archived or deleted.

The five specification files from my professor were the source of truth: the main specification,
`DATABASE.md`, `API.md`, `UI.md` and `TODO.md`. I kept them unchanged, except for checking off finished
items in `TODO.md`.

## How I worked

I built the project with Claude Code, an AI coding assistant, in one session on November 5, 2026.
Claude Code wrote the code, database migrations, tests and most of the documentation.

**My part was to:**
- write the prompt for each stage and review the results;
- decide to make the GitHub repository public, the one question it asked me;
- do the steps that need my own accounts: creating the Supabase project, running the migrations,
  adding the instructor account and setting up Cloudflare Pages.

The six stages were setup, building the app, testing, a UI review against `UI.md`, deployment, and
these submission documents. My exact prompts are in
[AI_DEVELOPMENT_HISTORY.md](AI_DEVELOPMENT_HISTORY.md).

## How the app is built

- **Frontend:** React, TypeScript, Vite and Tailwind CSS, as the specification asks, with Recharts for
  the charts and the `qrcode` package for the QR codes.
- **Backend:** there is no custom server. The site talks directly to Supabase, which provides the
  PostgreSQL database and the instructor login. The browser only has the public key. The data is
  protected by Row Level Security rules.
- **Database:** the five tables enforce the important rules themselves. Only one survey can be active,
  the same browser cannot submit twice, and students can never read responses.
- **Submissions:** each one goes through a single database function. It checks the answers and saves
  everything at once, so a bad submission never leaves half-saved data.
- **Hosting:** Cloudflare Pages rebuilds the site from GitHub on every push.

## Problems and how they were solved

- **ESLint would not install.** The Vite template uses TypeScript 7, which the ESLint TypeScript plugin
  does not support yet. Claude Code used oxlint and Prettier instead and recorded why in
  [DECISIONS.md](DECISIONS.md).
- **Editing could have deleted answers.** Deleting a survey's questions and adding them back on save
  would also delete answers students had already given. The save function updates questions in place
  instead.
- **"Closed" vs. "not found".** Students can only see the active survey, so the student page could not
  tell a closed survey from a wrong link. A small function that returns only a survey's status fixed
  this.
- **Testing without Docker.** The usual local Supabase setup needs Docker, which was not available. The
  tests run the real migrations on PGlite, a version of PostgreSQL that runs inside Node.
- **Bugs found by testing:**
  - zero-answer choices were missing from the chart;
  - bars were too thin on phones;
  - the Close button fell off a 1024×768 projector screen;
  - the CSV had no survey title or date.

  All four were fixed and now have tests ([TESTING.md](TESTING.md)).

## Testing and deployment

- **Local tests:** 20/20 unit, 32/32 database and 50/50 browser tests (25 each in Chrome and Firefox)
  pass, along with TypeScript, the linter and the build.
- **What the browser tests use and check:** they run against a local stand-in for Supabase. They check
  login, the survey lifecycle, the QR code, phone-sized answering, duplicate blocking, results, CSV and
  accessibility.
- **Not done yet:** the live Supabase and production tests (`npm run test:live`, `npm run test:prod`)
  need my instructor login, so they have not been run. Safari and iPhone could not be tested
  automatically, and there was no load test for 200 students.

The code is public on GitHub, and Cloudflare Pages deploys it automatically.

- **Checked on the live site:** direct links work, the site uses the right Supabase project with only
  the public key, signed-out visitors are sent to login, and a wrong password is rejected.
- **Not yet checked on the live site:** creating a survey, scanning, submitting, results and CSV.
- **Open problem:** public sign-up was still on in Supabase during the final check. I need to turn it
  off, because anyone who signs in gets instructor access.

## What I learned

- **Rules belong in the database.** Rules like "one active survey" are much safer there than only in
  React, because students can call the API directly.
- **Detailed specifications make an AI assistant more useful.** Most of my prompts pointed Claude Code
  back to the specification files, and that worked because the files were detailed.
- **"Deployed" is not the same as "working".** A homepage that loads only proves the homepage loads, so
  I kept the test report strict about what was actually checked.
- **Much of deployment is configuration.** Environment variables, the sign-up setting and the
  deep-link routing file all had to be right.
