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
# wait for http://localhost:3001 to answer, then, in order:
node docs/manual/_tools/01-accounts.cjs       # master invites Diego; Diego invites and activates the students
node docs/manual/_tools/02-assign.cjs         # practice and Tests assigned
node docs/manual/_tools/03-student-lucia.cjs  # player, Check, retry, Test module
node docs/manual/_tools/04-student-mateo.cjs  # save & exit, overdue, report a problem
node docs/manual/_tools/05-teacher.cjs        # teacher screens, invalidate, report, parents
node docs/manual/_tools/06-master-content.cjs # import step 1, editors, teachers
```

Each script depends on the data the previous ones created. **To start over, stop the server, then run `00-setup.cjs` again.** Never replace `man.db` while the server has it open, or the database can be corrupted.

## Notes

- **Login** goes through the NextAuth API inside the browser context (`login()` in `lib.cjs`). The UI login fails on :3001 with MissingCSRF because of the worktree's `AUTH_URL`.
- **No emails are sent:** `server.sh` leaves the `EMAIL_*` variables empty, so the screens show the activation links.
- **The Next.js dev badge is hidden** by CSS in the screenshots.
- **Accounts, passwords and removed content** are set in `config.cjs` and documented in `../cuentas-demo.md`.
- **When you finish:**
  - Stop the :3001 server.
  - Remove the worktree: `git worktree remove --force $MANUAL_WORK/wt`.
  - Delete `$MANUAL_WORK`.
