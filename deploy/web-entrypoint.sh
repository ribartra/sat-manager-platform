#!/bin/sh
set -e

# Apply pending Prisma migrations to the mounted SQLite DB. Idempotent: a no-op
# when the DB is already at the latest migration.
echo "[entrypoint] prisma migrate deploy ..."
npx prisma migrate deploy || echo "[entrypoint] migrate deploy failed (continuing with existing schema)"

exec "$@"
