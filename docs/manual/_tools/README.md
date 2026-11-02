# Manual screenshot tools

These scripts regenerate every image in `docs/manual/img/`. They run Playwright against an **isolated** copy of the app and database, so `dev.db` and your own dev server are never touched.

## Requirements

- `node_modules` installed in the repo (Playwright is used from there).
- Brave at `/usr/bin/brave-browser`. To use another Chromium, edit `open()` in `lib.cjs`.
- A local `dev.db`. Pull the latest with `cd deploy && make pull-db`.

## Run

`MANUAL_WORK` must be a temporary folder **outside the repo**. It holds the DB copy (production data) and a git worktree: never commit it.

```bash
export MANUAL_WORK=/tmp/sat-manual            # any scratch folder
node docs/manual/_tools/00-setup.cjs          # copy dev.db → $MANUAL_WORK/man.db, remove the "missing" content, add the master teacher
docs/manual/_tools/server.sh &                # worktree + next dev on :3001 against man.db (no SMTP)
docs/manual/_tools/ingest.sh &                # ingest service on :8000 against the same DB (Import with AI needs it)
# wait for http://localhost:3001 to answer, then, in order:
node docs/manual/_tools/01-accounts.cjs       # master invites Diego; Diego invites and activates the students
node docs/manual/_tools/02-assign.cjs         # practice and Tests assigned
node docs/manual/_tools/03-student-lucia.cjs  # player, Check, retry, Test module
node docs/manual/_tools/04-student-mateo.cjs  # save & exit, overdue, report a problem
node docs/manual/_tools/05-teacher.cjs        # teacher screens, invalidate, report, parents
node docs/manual/_tools/06-master-content.cjs # empty slot, editors, teachers
```

The "Import with AI" screenshots (`ai-step1-*`, `ai-step2-*`) create an import, so they are taken on a
**throwaway copy**, never on the `man.db` the user imports into. `MANUAL_DB` points the servers and
the script to that copy:

```bash
# servers stopped first
node -e 'const D=require("better-sqlite3");new D(process.argv[1],{readonly:true}).backup(process.argv[2])' $MANUAL_WORK/man.db $MANUAL_WORK/man-shots.db
MANUAL_DB=$MANUAL_WORK/man-shots.db docs/manual/_tools/server.sh &
MANUAL_DB=$MANUAL_WORK/man-shots.db docs/manual/_tools/ingest.sh &
MANUAL_DB=$MANUAL_WORK/man-shots.db node docs/manual/_tools/07-import-steps.cjs   # uses files_to_load/ (TEST 9, Nonlinear Functions HARD)
# then stop both, delete man-shots.db and start them again without MANUAL_DB
```

`08-review-update.cjs` retakes the screenshots changed by the review with Soledad (tests named
"Innovator Test N", Completed chip, report Period, reference sheet). It also runs on a throwaway copy
with the tests renamed as production (`prisma/data-patches/202611011800_tests_named_by_source.sql`
fails on `man.db` by design, it has no TEST 9: run its UPDATEs on the copy).

`09-classroom-homework.cjs` (Classroom / Homework screenshots) also runs on a throwaway copy, after
Lucía has Classroom work: "Linear Inequalities · Medium" done in class (10 of 13 answered) and then
assigned as Homework, and "Systems of Linear Equations · Easy" done in class.

Each script depends on the data the previous ones created. **To start over, stop the server, then run `00-setup.cjs` again.** Never replace `man.db` while the server has it open, or the database can be corrupted.

## Notes

- **Login:** the scripts sign in through the NextAuth API inside the browser context (`login()` in `lib.cjs`). `server.sh` sets `AUTH_URL` to :3001, so you can also sign in from the login screen to use this copy by hand (for example, for the AI import screenshots). The very first try after starting can fail while the page compiles: just try again.
- **Ingest service:** `ingest.sh` runs `ingest_service` with the system `python3` (requirements installed) on :8000, with the `.env` token, uploads under `$MANUAL_WORK/ingest-uploads` and extracted images in the worktree's `.private/uploads/ingest`.
- **No emails are sent:** `server.sh` leaves the `EMAIL_*` variables empty, so the screens show the activation links.
- **The Next.js dev badge is hidden** by CSS in the screenshots.
- **Accounts, passwords and removed content** are set in `config.cjs` and documented in `../cuentas-demo.md`.
- **When you finish:**
  - Stop the :3001 and :8000 servers.
  - Remove the worktree: `git worktree remove --force $MANUAL_WORK/wt`.
  - Delete `$MANUAL_WORK`.
