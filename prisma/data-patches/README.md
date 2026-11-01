# Data patches

Data changes (fixing content, normalizing values, backfilling a field) live here. They **never**
go in a Prisma migration or are run by hand on the VM. The schema only changes through
`prisma/migrations/`, and only when there's no other way.

**How they're applied:** with `scripts/apply-data-patches.mjs`.
- **Production:** on every deploy (`deploy/vm/web-entrypoint.sh`, after `migrate deploy` and before traffic).
- **Local:** with `npm run db:patch`.

Each patch:
- runs **once**, in its own transaction;
- is recorded in `AppSetting` (`DATA_PATCH:<file>`, with its checksum), so no new tables are needed.

If a patch fails, it rolls back, the container doesn't start, and `deploy.sh` goes back to the previous version.

## Writing one

File name: `YYYYMMDDHHMM_<what-it-does>.sql` (or `.mjs`). They run in name order.

```sql
-- Fixes the answer of question X (wrong key in the source; see issue 123).
-- expect: 1
UPDATE "Question" SET "correctAnswer" = 'B' WHERE "id" = 'cmsj…' AND "correctAnswer" = 'C';
```

**SQL rules:**
- Only data statements: `UPDATE`, `INSERT`, `DELETE`, `REPLACE`, `WITH`, `SELECT`. Anything else is rejected.
- No `BEGIN`/`COMMIT`: the runner opens the transaction.
- `-- expect: <n>` is the number of rows it must change (SQLite `total_changes`, which also counts rows changed by triggers). Use it whenever the number is known: if the data isn't what you expected, the patch fails instead of half-applying.
- Write **guarded** `WHERE` clauses (filter by id **and** the previous value). That way the patch doesn't touch anything someone has already fixed some other way.

For logic that SQL can't express, use a `.mjs` file:

```js
export const expect = 3; // optional
export default function (db) {
  // db = better-sqlite3 (synchronous). Return value ignored; rows are counted with total_changes.
  const fix = db.prepare('UPDATE "Question" SET "stem" = ? WHERE "id" = ? AND "stem" = ?');
  for (const row of rows) fix.run(row.next, row.id, row.prev);
}
```

## Flow

1. `npm run db:patch` on your `dev.db`, which is a copy of production (`cd deploy && make pull-db`). Check the result.
2. Commit the patch.
3. `cd deploy && make build && make release TAG=…`: production applies it on startup.
4. `cd deploy && make db-compare`: local and production must match.

**Never edit a patch that has already been applied:** the runner detects the change and stops. To correct a patch, write a new one.

`npm run db:patch:status` shows which patches are applied and which are pending.
