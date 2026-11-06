# AI Development History

This file explains how I built the project with **Claude Code**, Anthropic's AI coding assistant. I
ran it in VS Code with the `claude-opus-5-5` model. Everything here comes from the saved Claude Code
session transcript (one `.jsonl` file), the git history and the project files.

## How to read this file

- **Verbatim** means copied exactly from the transcript, without any edits. This covers my prompts and
  the one question Claude Code asked me, with my answer.
- **Summary** sections are my own short descriptions of what happened, based on the transcript. They
  are not quotes.
- **Timing:** all times are local (UTC−5) on **November 5, 2026**. Everything happened in one Claude
  Code session.
- **Context limit:** partway through, the session reached its context limit. Claude Code then wrote a
  summary of the earlier conversation for itself and kept going. I did not re-enter any prompts.
- **How the work was split:** I pasted each prompt into Claude Code. Between stages I did the account
  and dashboard steps that Claude Code could not do. These are listed under "Manual steps I did".
- **Decision numbers:** in Stages 1–7, numbers like "DECISIONS.md #2" refer to the older 31-item
  version of DECISIONS.md. Stage 8 rewrote it as 18 points.

## Stage 1: Project setup (18:57–19:01)

**My prompt (verbatim):**

> Read all five provided Markdown specification files for my CSE 4095 Classroom Survey Web App assignment. Follow them as the source of truth.
>
> Plan and initialize a React + TypeScript + Supabase project with a simple, reliable architecture. Identify all rubric requirements, create the project structure, install dependencies, and set up routing and styling.
>
> Keep responses concise, make changes directly, and avoid unnecessary explanations. Preserve the original specification files. Document important decisions. Begin implementation and report only blockers or required manual actions.

**Summary of what happened:**

- **Project start:** Claude Code created the project from the Vite `react-ts` template. It then added
  Tailwind CSS v4, React Router, supabase-js, Recharts and qrcode.
- **ESLint failed to install.** `typescript-eslint` needs `typescript >=4.8.4 <6.1.0`, but the template
  installs TypeScript 7. Claude Code used oxlint, which came with the template, plus Prettier, and wrote
  the reason in DECISIONS.md (#2).
- **The first build failed** with "Cannot apply unknown utility class `btn`", because Tailwind v4 does
  not allow `@apply` with custom class names. The shared styles were rewritten with `@utility`.
- **What was built:**
  - The first database migration: the five tables, constraints, indexes, the one-active-survey rule,
    Row Level Security policies, and functions to activate, close and submit a survey.
  - All the routes from UI.md, login and logout, protected instructor pages, and the dashboard.
  - README.md, DECISIONS.md (14 entries at that point), and SPEC.md as an index of the five spec files.
- **Reported to me:**
  - Many TODO.md boxes were already ticked before any code existed.
  - I needed to create the Supabase project, run the migration and add the instructor user.
  - Git had not been set up yet.

## Stage 2: Full implementation (19:01–19:11)

**My prompt (verbatim):**

> Implement the complete Classroom Survey Web App according to all five specifications.
>
> Instructor: secure login, create/edit/list surveys, MCQ and true/false questions, activate/close surveys, enforce one active survey, view results with counts/percentages, CSV export.
>
> Student: anonymous survey access through URL/QR code, answer selection, submission, confirmation, duplicate protection.
>
> Presentation: survey title, working QR code, URL, live response count.
>
> Build responsive interfaces with proper validation, loading, and error handling. Implement all required functionality, not placeholder buttons or mock results.
>
> Use Supabase for authentication and persistent storage. Create the five required related tables, migrations, constraints, RLS policies, and secure submission handling. Never expose secrets.
>
> Implement directly, run available checks, and stop only when my manual Supabase configuration is required. Give exact instructions when blocked.

**Summary of what happened:**

- **Second migration** (`20261105000100_survey_functions.sql`):
  - `save_survey` saves a whole survey in one transaction and **keeps the existing question and choice
    IDs**, so editing a closed survey does not delete its recorded answers.
  - `get_survey_status` lets the student page tell a closed survey apart from a wrong link.
  - `survey_choice_counts` counts the answers in the database, which avoids Supabase's 1000-row limit.
  - Explicit grants let anonymous visitors read only surveys, questions and choices.
- **Pages:** the editor, the QR present page, the results page and the student page were built.
- **Bundle size:** a test build made one 854 kB JavaScript file. Claude Code split the instructor pages
  into separate files that load only when needed, so students download about 142 kB gzipped.
- **Missing settings:** a build without the Supabase settings produced an empty app. Now the app shows
  a "Supabase is not configured" message instead.
- **SQL check:** Claude Code checked the SQL with a temporary script that ran the migrations on PGlite.
  The script was kept in the session's scratch folder, not in the repo, and reported "39 passed, 0
  failed". In Stage 3 it was replaced by the real test suite.
- **Lint warnings:** 4 warnings were left (`react/set-state-in-effect`).
- **Stopped for setup:** Claude Code stopped here and gave me step-by-step Supabase setup instructions.

## Stage 3: Testing and debugging (19:22–19:49)

**My prompt (verbatim):**

> Thoroughly test and debug the entire application against the specifications and grading rubric.
>
> Verify instructor authentication, survey creation/editing/activation/closing, anonymous student submissions, QR codes, duplicate prevention, database persistence, results calculations, CSV export, security/RLS, and desktop/mobile usability.
>
> Run automated tests, TypeScript checks, lint, and production build. Fix issues and rerun failed checks.
>
> Create TESTING.md documenting actual tests, bugs, fixes, and remaining limitations. Do not invent passing results.
>
> Update TODO.md accurately. Keep output concise and tell me only what needs manual verification.

**Summary of what happened:**

- **Test suites written:**
  - 20 Vitest unit tests.
  - 32 database tests that run the real migrations on PGlite with Supabase-style `anon` and
    `authenticated` roles.
  - 25 Playwright browser tests. They run the production build against `tests/e2e/fake-supabase.ts`, a
    small local stand-in for Supabase. It handles the login, REST and RPC calls the app makes, and runs
    each query on PGlite as the right role.
- **Safari engine would not start.** Playwright's WebKit failed on macOS 14 with "Unknown setting:
  PushAPIEnabled". The tests use Chrome and Firefox instead, and Safari is listed as untested. While
  switching, Claude Code removed a WebKit build from Playwright's shared download folder on my machine,
  and it told me it had done this.
- **App bugs fixed:**
  - Choices with zero answers showed no bar and no count or percentage. Fixed with `minPointSize={2}`.
  - The Count and Percent columns did not line up between questions.
  - The 4 lint warnings were reviewed and that rule was turned off, with the reason written down.
- **Test mistakes fixed** (the app was right, the test was wrong):
  - A link had been treated as a button.
  - A screenshot was taken before the data loaded.
  - The network-failure test did not wait long enough for supabase-js's automatic retries.
- **Live Supabase project:** a quick check showed the migrations had not been run there yet. The live
  tests were written but marked "Not run".
- **Docs:** TESTING.md was created. TODO.md was updated, with "local" marking items checked only on the
  local test setup.
- **Final result:** 20/20 unit tests, 32/32 database tests and 50/50 browser tests passed.

## Stage 4: UI review (19:53–19:59)

**My prompt (verbatim):**

> Review my complete application UI against the professor-provided UI.md and Classroom_Survey_Web_App_Specification.md.
>
> Verify that every required page, component, button, workflow, and responsive layout is implemented correctly. Compare the actual rendered application against the wireframes, fix missing requirements, and ensure the interface is clean, professional, and mobile-friendly.
>
> Do not redesign unnecessarily or change working functionality. Run the build and relevant tests after changes. Report any requirements that still need manual verification. Keep the response concise.

**Summary of what happened:**

Claude Code rendered every page with realistic data at phone, tablet, desktop and 1024×768 projector
sizes and compared each one with the UI.md wireframes.

**Fixes:**
1. Results bars were too thin on phones.
2. The present page's Close button was pushed off a 1024×768 screen.
3. The "Present QR" button now also shows on closed surveys' results pages, since UI.md §9 lists it.
4. Dashboard dates now read like "Nov 5, 2026".

Each fix got a browser test, and all test suites passed again. A few small differences from the
wireframes were kept on purpose and written down in TESTING.md: a status badge, the "Save & Activate"
label, and some extra buttons.

## Stage 5: Prepare and deploy (20:05–20:08, then waiting for me)

**My prompt (verbatim):**

> Prepare and deploy the completed application.
>
> Create a complete README.md with installation, Supabase setup, environment variables, testing, and deployment instructions.
>
> Ensure the repository contains source code, all five original specifications, updated TODO.md, database migrations, and documentation.
>
> Check for exposed credentials and ensure .env files are ignored.
>
> Help me create/push the GitHub repository and deploy the application publicly using Cloudflare Pages or another compatible platform.
>
> Configure production environment variables securely. Verify the live instructor and student workflows, QR codes, submissions, persistence, and results.
>
> Stop for account authorization or manual configuration when necessary. Do not claim deployment succeeded without verification.
>
> Provide the actual GitHub and deployed application URLs.

**Clarifying question from Claude Code (verbatim):**

> I'm about to create the GitHub repository pr1yanshii/classroom-survey and push the code. It contains no credentials (I scanned for them). Should the repository be public or private? Cloudflare Pages can deploy from either, and the live website will be public either way.

**My answer (verbatim):** "Public (Recommended)"

**Summary of what happened:**

- **README:** rewritten.
- **Credential check:** Claude Code searched every tracked file for my real Supabase URL and key and
  for secret-key patterns. It found none, and confirmed git ignores `.env.local`.
- **Clean-install check:** a fresh `npm ci` and build using only the committed files worked.
- **GitHub:** `gh repo create pr1yanshii/classroom-survey --public` created the repository and pushed
  two commits (`94ff29d` and `e9707d4`).
- **Production test:** Claude Code added `npm run test:prod`, a full browser test against the deployed
  site.
- **Stopped for my accounts:** Supabase and Cloudflare setup needed my accounts, so Claude Code stopped
  and gave me step-by-step instructions. It did not claim the app was deployed.

## Manual steps I did (not done by Claude Code)

- Created the Supabase project and put its URL and publishable key in `.env.local`.
- Ran both migrations and created the instructor account.
- Created the Cloudflare Pages project linked to the GitHub repository, with the two
  `VITE_SUPABASE_*` environment variables. It deployed to <https://classroom-survey-63r.pages.dev>.

## Stage 6: Final submission documents (21:11–21:20)

**My prompt (verbatim):**

> We have successfully deployed the Classroom Survey Web App to Cloudflare Pages.
>
> Production URL: https://classroom-survey-63r.pages.dev/
> GitHub repository: https://github.com/pr1yanshii/classroom-survey
>
> Now complete the FINAL SUBMISSION stage of my CSE 4095 assignment.
>
> Read all five professor-provided specification files, the current README.md, TODO.md, DECISIONS.md, and TESTING.md, and review the actual project implementation.
>
> Complete the following:
>
> 1. Create DEVELOPMENT_SUMMARY.md containing a clear, natural, student-written 1–2-page development summary. Explain the project, architecture, technologies, implementation process, challenges, testing, deployment, and lessons learned. Keep it accurate and avoid exaggerated claims.
>
> 2. Create AI_DEVELOPMENT_HISTORY.md documenting the actual development process with Claude Code. Include the major prompts, decisions, implementation stages, bugs encountered, fixes, testing, and deployment. Use the real conversation history available to you. Do not invent prompts, tests, or interactions. Clearly distinguish summaries from verbatim transcripts.
>
> 3. Create EVIDENCE.md listing the screenshots required for submission, including the instructor dashboard, survey editor, QR presentation page, student survey, results, Supabase database tables, and deployed application. Identify screenshots that I must capture manually. Do not fabricate screenshots or claim screenshots were captured unless they actually exist.
>
> 4. Create FINAL_SUBMISSION_CHECKLIST.md comparing every assignment requirement and grading rubric item against the actual implementation. Identify anything incomplete, unverified, or missing.
>
> 5. Review the CSV export requirements and fix any remaining implementation gaps, including survey title and date metadata if required by the specifications.
>
> 6. Run all available automated tests, typechecking, linting, and the production build. Run the live Supabase and production tests only if the required credentials and configuration are available locally. Never invent passing results.
>
> 7. Update README

(The prompt ended at "7. Update README" as pasted.)

(The prompt ended at "7. Update README" as pasted.)

**Summary of what happened:**

- **Live-site checks without logging in:**
  - The deployed code uses the same Supabase project and public key as `.env.local`, and contains no
    secret key.
  - The migrations had been run on the live project.
  - In Chrome, direct links worked, signed-out visitors were sent to login, and a wrong password was
    rejected.
- **Problem found:** public sign-up was still turned on in Supabase. This is listed as an open security
  item for me to fix in the Supabase dashboard.
- **CSV gap fixed:** the CSV had no survey title or date. Claude Code added `survey_title` and
  `survey_created_at` columns after the question columns, which keeps API.md's recommended layout. The
  unit, browser and production tests were updated to match.
- **Checks re-run:**
  - Typecheck, lint and the build passed.
  - 52/52 unit and database tests passed, and 50/50 browser tests passed.
  - `test:live` (10 skipped) and `test:prod` (1 skipped) were skipped, because my login details were
    not available locally.
- **Documents:** Claude Code wrote this file, DEVELOPMENT_SUMMARY.md, EVIDENCE.md and
  FINAL_SUBMISSION_CHECKLIST.md. It also updated TESTING.md, TODO.md, DECISIONS.md (#31) and README.md.

## Stage 7: Writing review (21:20–21:28)

**My prompt (verbatim):**

> Before committing and pushing my final Classroom Survey assignment, please review and improve the writing in all documentation files.
>
> Focus especially on:
> - DEVELOPMENT_SUMMARY.md
> - AI_DEVELOPMENT_HISTORY.md
> - EVIDENCE.md
> - FINAL_SUBMISSION_CHECKLIST.md
> - README.md
> - TESTING.md
> - DECISIONS.md
> - TODO.md
>
> WRITING REQUIREMENTS:
>
> 1. Use simple, natural English that sounds like a college student explaining their project.
> 2. Avoid overly formal, robotic, or AI-sounding language.
> 3. Use short, clear sentences and straightforward vocabulary.
> 4. Keep the writing professional but not unnecessarily technical.
> 5. Avoid repetitive explanations, exaggerated claims, and generic filler.
> 6. Use first person where appropriate, especially in DEVELOPMENT_SUMMARY.md.
> 7. Make the development summary sound personal and realistic, explaining what I worked on, what problems came up, how they were fixed, and what I learned.
> 8. Keep the development summary within the required 1–2 pages.
> 9. Be transparent that Claude Code assisted with development. Do not invent personal experiences or claim I manually wrote code that Claude generated.
> 10. Preserve the actual development history. Do not rewrite verbatim prompts, conversation excerpts, or exact quotations in AI_DEVELOPMENT_HISTORY.md.
> 11. Keep all technical facts, test results, dates, URLs, filenames, commands, and assignment requirements accurate.
> 12. Do not remove important information just to make the writing shorter.
> 13. Do not change any application code, database migrations, configuration, or professor-provided specification files.
> 14. Make sure every document is clearly organized, easy to read, and suitable for submission to my CSE 4095 professor.
>
> IMPORTANT:
> I want the documentation to sound natural and human-written, but everything must remain truthful and consistent with the actual project. Do not invent results, testing, challenges, or contributions.
>
> After revising, review all documents for grammar, clarity, consistency, and completeness.
>
> Give me a short summary of the writing changes. Do not commit or push yet. I want to review the final documents first.

**Summary of what happened:**

- **Rewrote the documents in plainer language.** This covered the submission documents, README.md,
  TESTING.md and DECISIONS.md. In TODO.md only the status notes were touched, not the professor's task
  wording.
- **Shortened the development summary.** It was rendered to a Letter-size PDF (11 pt, 1-inch margins)
  to check its length. It came to 3 pages, so it was cut to 2.
- **Fixed three inconsistencies:**
  - DECISIONS.md #14 still said TODO.md was "left as provided".
  - DECISIONS.md #5 said the schema was in one migration, but there are two.
  - TESTING.md called Stages 1–2 a "previous session", but everything happened in one session.
- **Checked the quotes:** the verbatim prompts in this file were checked against the transcript.
- **Code untouched:** no application code, migrations, configuration or specification text was
  changed, and nothing was committed or pushed.

## Stage 8: Rewriting DECISIONS.md (21:28–21:32)

**My first message (verbatim):** I pasted this draft with no other text.

> # Implementation Decisions
>
> These are the main decisions made while building the Classroom Survey Web App.
>
> 1. **Frontend Technology:** We used React, TypeScript, and Vite because they made it easier to build and organize the application.
>
> 2. **Styling:** We used Tailwind CSS to keep the design consistent and make the application work on phones, tablets, and computers.
>
> 3. **Database:** We chose Supabase with PostgreSQL because it provides a database and authentication in one service.
>
> 4. **Instructor Login:** We used Supabase Authentication so instructors can securely log in with their email and password.
>
> 5. **Student Access:** Students do not need accounts. They can scan a QR code and answer the survey directly, making participation easier during class.
>
> 6. **Survey Management:** Instructors can create, edit, duplicate, archive, and delete surveys so they can prepare and reuse questions.
>
> 7. **Survey Status:** We used Draft, Active, Closed, and Archived statuses to keep surveys organized.
>
> 8. **One Active Survey:** We allow only one active survey at a time to avoid confusion during class.
>
> 9. **QR Codes:** Each active survey has a QR code that students can scan to open the correct survey.
>
> 10. **Duplicate Submissions:** We use a browser-generated token and a database constraint to reduce repeated submissions from the same browser. This does not completely prevent submissions from different browsers or devices.
>
> 11. **Database Security:** We use Row Level Security to protect survey information and prevent anonymous students from accessing instructor-only data.
>
> 12. **Survey Responses:** Student answers are saved in Supabase so instructors can view results later.
>
> 13. **Results Dashboard:** We display answer counts, percentages, and charts to make student responses easier to understand.
>
> 14. **Live Response Count:** The presentation page checks for new responses every few seconds so instructors can monitor participation.
>
> 15. **CSV Export:** We added CSV export so instructors can download survey responses and open them in spreadsheet applications.
>
> 16. **Deployment:** We chose Cloudflare Pages because it provides free hosting and was required by the project specifications.
>
> 17. **Testing:** We used automated tests to check the application, database rules, and major user workflows. Some real-device and load testing still needs to be completed.
>
> 18. **Future Improvements:** Possible improvements include live-updating charts, better support for multiple instructors, and stronger duplicate-submission protection.

**My follow-up message (verbatim):** I sent this while Claude Code was working. It arrived cut off
after "rem".

> Rewrite DECISIONS.md using these 18 points as the main structure. Keep the language simple and natural. Verify everything against the implementation, preserve important technical details where necessary, and rem

**Summary of what happened:**

- **Interpreting the request:** Claude Code took the cut-off ending to mean "remove anything
  inaccurate".
- **Checked against the code:** before writing, each of the 18 points was checked against the code and
  migrations. This covered:
  - the Row Level Security policies and permissions;
  - which functions are `SECURITY DEFINER` and which are `SECURITY INVOKER`;
  - the survey-code alphabet and the "Copy of" title;
  - lazy loading, the browser token and the QR URL;
  - the dashboard confirmation dialogs and CSV paging.
- **Accuracy fixes in my draft:**
  - Points 1 and 3 said React, TypeScript, Vite and Supabase were chosen because they were convenient.
    The specification (§7) actually requires them.
  - Point 14 said "every few seconds", which became "every 3 seconds".
- **How DECISIONS.md was rebuilt:** my 18 points are now the headings, each with the important
  technical details from the old 31 decisions underneath. The two notes about the specification
  files (SPEC.md and the TODO.md updates) became a short section at the end.
- **References updated:** other documents pointed to the old numbers, so these were changed:
  - TODO.md and FINAL_SUBMISSION_CHECKLIST.md: #2 became #17;
  - TESTING.md: #9 became #4;
  - the checklist's "31 decisions" became "18 decisions".
- **Code untouched:** no application code, migrations, configuration or specification text was
  changed, and nothing was committed or pushed.

## Stage 9: Final commit and deployment (21:32–21:44)

> We have finished reviewing the documentation for my CSE 4095 Classroom Survey Web App.
>
> Please complete the final deployment process.
>
> 1. Review all modified files, including DECISIONS.md and the four submission documents.
> 2. Confirm that the documentation uses simple, natural language and accurately describes the project.
> 3. Verify that the original professor-provided specification files remain unchanged.
> 4. Make sure no passwords, private environment files, or secret keys are included in the commit.
> 5. Run typechecking, linting, automated tests, and the production build again.
> 6. Commit and push all final changes to the main branch of my existing GitHub repository.
> 7. Check that Cloudflare Pages successfully deploys the latest commit.
> 8. Confirm that the updated CSV export is included in the production build.
> 9. Do not claim the live workflow passed unless it was actually tested.
>
> After completing these steps, give me the commit hash, deployment status, test results, and any remaining tasks before submission.
>
> GitHub: https://github.com/pr1yanshii/classroom-survey
> Production: https://classroom-survey-63r.pages.dev/

**Summary of what happened:**

- **Review before committing:**
  - The four original specification files were confirmed unchanged since the first commit.
  - `.env.local` was confirmed git-ignored.
  - The files to be committed were scanned for the real Supabase URL and key and for secret-key and
    password patterns. The only match was the made-up password of the local test stand-in
    (`correct-horse-battery`), which was already in the repository.
- **Checks re-run:**
  - Typecheck, lint, Prettier and the build passed.
  - 52/52 unit and database tests and 50/50 browser tests passed.
  - `test:live` (10 skipped) and `test:prod` (1 skipped) were skipped, because no login details were
    available locally.
- **Commit:** `3af973b` ("Add CSV survey metadata and final submission documents") was pushed to
  `main`. Only the 13 reviewed files were staged.
- **Deployment confirmed:**
  - The "Cloudflare Pages" check on GitHub finished with **success** for `3af973b`.
  - The live site serves the same file names as the local build (`index-BCtea890.js`,
    `Results-Ck41Q37i.js`).
  - The live results code contains `survey_title` and `survey_created_at`.
- **Checks without logging in, run again:** deep link, landing page, login redirect and wrong-password
  rejection all passed.
- **Sign-up setting:** this check showed Supabase now has `disable_signup: true`, so public sign-up
  had been turned off since Stage 6.
- **Status notes updated:** TESTING.md, FINAL_SUBMISSION_CHECKLIST.md, EVIDENCE.md, DECISIONS.md and
  DEVELOPMENT_SUMMARY.md were updated to match, and this stage was added here. These changes went in a
  second commit.
- **Still not tested:** the logged-in workflow on the live site has not been tested.

## Stage 10: Finalizing (21:44–21:56)

> I have confirmed that public sign-up is disabled in Supabase. I also verified that all 5 database tables and all 7 required functions exist.
>
> Please now finalize my CSE 4095 Classroom Survey project.
>
> 1. Review the latest documentation changes, especially DECISIONS.md.
> 2. Confirm that all documentation uses simple, natural language.
> 3. Check that the original professor-provided specifications are unchanged.
> 4. Check that no passwords, secret keys, or private environment files will be committed.
> 5. Run typechecking, linting, automated tests, and the production build.
> 6. Commit and push the final changes to GitHub main.
> 7. Verify that Cloudflare Pages deploys the latest commit.
> 8. Check that the updated CSV export is included in production.
> 9. Report the final commit hash, deployment status, and test results.
>
> GitHub: https://github.com/pr1yanshii/classroom-survey
> Production: https://classroom-survey-63r.pages.dev/
>
> Do not change working features unnecessarily. Do not claim unverified tests passed.

**Summary of what happened:**

- **No pending changes:** there were no local changes since `89a8388`.
- **Live database checked:** Claude Code confirmed my dashboard check with anonymous calls that can't
  change data:
  - all 5 tables exist;
  - all 7 functions exist;
  - the instructor functions refuse anonymous users;
  - `submit_survey_response` rejects a made-up survey without saving anything.
- **Checks re-run:**
  - The specification files are still unchanged, and only `.env.example` is tracked.
  - Typecheck, lint, Prettier and the build passed.
  - 52/52 unit and database tests and 50/50 browser tests passed.
  - `test:live` and `test:prod` were skipped (no login details available locally).
- **Docs:** TESTING.md and FINAL_SUBMISSION_CHECKLIST.md now record the database check. This stage was
  added here, then committed and pushed.

## Stage 11: Test run for the screenshot (21:56–22:04)

> I need to capture Screenshot 18 (18-tests.png) for my CSE 4095 Classroom Survey assignment.
>
> Please run the following commands in my existing project:
>
> 1. npm run typecheck
> 2. npm run lint
> 3. npm test
> 4. npm run test:e2e
> 5. npm run build
>
> Run them individually and report their actual results.
>
> Afterward, give me a clean, readable terminal summary showing which checks passed, how many tests passed, and whether any tests were skipped or failed.
>
> Do not invent results or hide failures. Do not modify application code unnecessarily.
>
> Tell me exactly which terminal output I should screenshot for my submission.

**Summary of what happened:**

- **Commands run:** Claude Code ran the five commands one at a time. All passed:
  - typecheck and lint showed no errors;
  - 52/52 Vitest tests passed;
  - 50/50 Playwright tests passed;
  - the build passed.
- **Screenshot advice:** it suggested one command chain with `--reporter=dot`, so the output fits in a
  single screenshot.
- **What I did:** I ran that in my own terminal and took screenshot 18.

## Manual steps I did between Stages 11 and 12

- **Live test:** I tested the full workflow by hand on the live site in desktop Chrome. I logged in,
  created and activated a survey, submitted a response, saw the duplicate block, checked the results
  and closed the survey.
- **CSV:** I opened the exported CSV in Excel (web).
- **Screenshots:** I took 19 screenshots.
- **File moves:** I moved them, along with `AI_DEVELOPMENT_HISTORY.md`, `DECISIONS.md` and
  `EVIDENCE.md`, into a new `docs/` folder.

## Stage 12: Final audit (22:04–22:07)

> Perform a quick, token-efficient FINAL SUBMISSION AUDIT of my CSE 4095 Classroom Survey Web App.
>
> Everything is already built, tested, deployed, and working. Do NOT rerun tests, builds, lint, typechecking, or deployment.
>
> GitHub: https://github.com/pr1yanshii/classroom-survey
> Live site: https://classroom-survey-63r.pages.dev/
>
> Check only the following:
>
> 1. **Assignment requirements:** Compare the existing project and FINAL_SUBMISSION_CHECKLIST.md against the professor's five specification files. Identify only missing or incomplete requirements.
>
> 2. **Documentation:** Verify README.md, DEVELOPMENT_SUMMARY.md, AI_DEVELOPMENT_HISTORY.md, DECISIONS.md, TESTING.md, TODO.md, and FINAL_SUBMISSION_CHECKLIST.md are complete, consistent, accurate, and written in simple, natural student language.
>
> 3. **Report:** Confirm DEVELOPMENT_SUMMARY.md is suitable as a 1–2-page development report. Identify any necessary corrections.
>
> 4. **Screenshots:** Check docs/screenshots/ against EVIDENCE.md. List only missing, incorrect, or unreadable screenshots. Do not require optional screenshots unnecessarily.
>
> 5. **GitHub:** Check for uncommitted changes and confirm the required files are included in the repository. Do not push anything.
>
> 6. **Submission:** Identify the exact files and links I should submit. Clearly distinguish professor-required items from recommended extras. Do not assume a PDF, ZIP, or video is required without evidence.
>
> 7. **Final readiness:** Give a short verdict: READY, READY WITH LIMITATIONS, or NOT READY, followed by only the remaining essential actions.
>
> IMPORTANT:
> - Do not run tests, builds, lint, or typechecking.
> - Do not modify code, documentation, or configuration.
> - Do not commit or push.
> - Do not repeat previous test results in detail.
> - Do not perform unnecessary research.
> - Do not invent requirements or verification results.
> - Keep your final response concise, ideally under 400 words.
>
> I only want to know whether anything essential is missing before submission.

**Summary of what happened:**

Claude Code checked the repository without running any tests or changing anything. It found:
- **Broken links:** 11, caused by moving the three files into `docs/`.
- **Screenshot names:** the screenshots still had macOS default names, and EVIDENCE.md listed every one
  as "Not taken".
- **Missing screenshots:** #10 (closed-survey message) and #17 (GitHub page). #7 was taken in a desktop
  browser rather than on a phone.
- **Privacy:** two screenshots show personal details.
- **Out-of-date notes:** several documents still said the live workflow and the Excel check were not
  done.

Its verdict was "READY WITH LIMITATIONS".

## Stage 13: Cleanup (22:07 onward)

> Please finish the remaining cleanup for my Classroom Survey project based on your audit.
>
> Fix the broken links, rename and organize the screenshots, and update EVIDENCE.md to show which screenshots are completed or missing.
>
> Also update the documentation to reflect that I have tested the full workflow on the live website and opened the CSV in Excel. Keep the writing simple and natural, and don't change anything unnecessary.
>
> Check the screenshots for any personal information and let me know if anything needs to be removed. Keep the missing screenshots and untested features clearly listed.
>
> Don't change the application code, run tests, or rebuild anything.
>
> Once everything is done, give me a short summary of what you changed and what's still left. Don't commit or push anything yet.

**Summary of what happened:**

- **Links:** all 11 broken links were fixed by pointing them at `docs/`. README's project structure now
  lists `docs/`.
- **Screenshots:** each one was renamed to its EVIDENCE.md file name, matched by its timestamp. The
  close dialog and the closed dashboard were added as extras #19 and #20.
- **EVIDENCE.md:** rewritten to show which screenshots are done, which are missing, and a privacy
  check. Personal details were found in three screenshots:
  - `15a`: my personal email;
  - `16`: part of my Cloudflare login email;
  - `12`: my Microsoft profile photo.
- **Live test recorded:** my manual live test and the Excel check were added to TESTING.md, TODO.md
  (Phases 11 and 15), FINAL_SUBMISSION_CHECKLIST.md, README.md, DEVELOPMENT_SUMMARY.md and
  DECISIONS.md (#15).
- **Untouched:** no application code, configuration or specification text was changed. Nothing was
  run, and nothing was committed or pushed.

## Stage 14: Phone QR test

**My message (verbatim):**

> ive tested the qr code on phone

**Summary of what happened:**

- **Docs updated:** the phone scan was recorded in TESTING.md, TODO.md, FINAL_SUBMISSION_CHECKLIST.md,
  README.md, DEVELOPMENT_SUMMARY.md and EVIDENCE.md.
- **What was recorded:** only that scanning the QR code with my phone opened the survey on the live
  site. The phone model and browser, and whether I submitted from the phone, weren't stated, so the
  documents don't claim them.

## Stage 15: iPhone details and final push

**My message (verbatim):**

> The QR code test was done on my iPhone. I scanned the QR code and successfully opened the live survey, but I didn't submit a response from the phone.
>
> Please update the documentation to reflect this accurately. Don't claim I tested submission or Safari specifically.
>
> I'm fine with the screenshots as they are, so no more screenshot changes are needed.
>
> Now do one final quick check, then commit and push all the documentation and screenshots to GitHub. Don't change application code or rerun tests.
>
> Confirm the push succeeded and give me a short summary of what I need to submit.

**Summary of what happened:**

- **Phone test:** the documents now say the QR scan was done on my iPhone and opened the live survey,
  with no submission from the phone. Safari isn't claimed.
- **Screenshots:** during the final check, Claude Code found that I had added two more screenshots,
  `10-student-closed.png.png` and `17-github.png`. It checked them and marked #10 and #17 as done, so
  17 of 18 are now done; only the optional #5 is missing. #10 also showed the closed-survey message
  working on the live site, so it was added to TESTING.md. The files were left exactly as I named them.
  The personal details in the other screenshots were kept by my choice.
- **Pushed:** after a final check, the documentation and screenshots were committed and pushed. No
  application code was changed and no tests were run.

## What the AI did and did not do

- **Claude Code** wrote the application code, migrations, tests and most of the documentation. It ran
  all the automated checks, and it created and pushed the GitHub repository after I asked it to.
- **I** wrote the prompts, chose to make the repository public and reviewed each stage's report. I also
  did all the account and dashboard work in Supabase and Cloudflare, and provided the course
  specification files.
- **Done by me on the live site:**
  - the full signed-in workflow, by hand in desktop Chrome;
  - opening the CSV in Excel (web);
  - scanning the QR code with my iPhone, which opened the survey (I didn't submit from the phone).
- **Not done by anyone yet:**
  - The automated live tests.
  - Submitting from a phone, an Android phone and a projector check.
  - A 200-student load test.

  These are tracked in [FINAL_SUBMISSION_CHECKLIST.md](../FINAL_SUBMISSION_CHECKLIST.md).
