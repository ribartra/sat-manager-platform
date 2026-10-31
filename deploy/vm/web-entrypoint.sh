#!/bin/sh
set -e

# Apply pending Prisma migrations to the mounted SQLite DB. Idempotent: a no-op when the DB is
# already at the latest migration. A failed migration STOPS the container: serving the new code
# against an old schema corrupts data or 500s. deploy/vm/deploy.sh then rolls back to the previous TAG.
echo "[entrypoint] prisma migrate deploy ..."
if ! npx prisma migrate deploy; then
  echo "[entrypoint] migrate deploy FAILED - refusing to start (restore the previous TAG; see deploy/docs/runbook.md)" >&2
  exit 1
fi

# Data backfills that must run before traffic (idempotent).
node scripts/backfill-fpt-snapshots.mjs || echo "[entrypoint] FPT snapshot backfill failed (attempts fall back to the live exam)" >&2

exec "$@"
