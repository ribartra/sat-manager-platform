#!/usr/bin/env bash
# Starts the app for the screenshots on :3001 from a git worktree in $MANUAL_WORK (own .next, so a
# local dev server on another port keeps running), against the database copy, with NO email (SMTP
# variables removed: nothing is sent; the screens show the invitation links instead).
set -euo pipefail
: "${MANUAL_WORK:?set MANUAL_WORK}"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
WT="$MANUAL_WORK/wt"
if [ ! -d "$WT/app" ]; then
  git -C "$REPO" worktree prune
  GIT_LFS_SKIP_SMUDGE=1 git -C "$REPO" worktree add --detach "$WT" HEAD -q
  ln -sfn "$REPO/node_modules" "$WT/node_modules"
  [ -e "$WT/app/generated/prisma/client.ts" ] || cp -r "$REPO/app/generated" "$WT/app/"
  rm -rf "$WT/files_to_load"
fi
grep -v '^EMAIL_' "$REPO/.env" > "$WT/.env"
cd "$WT"
exec env DATABASE_URL="file:$MANUAL_WORK/man.db" AUTH_URL="http://localhost:3001" npx next dev --webpack -p 3001
