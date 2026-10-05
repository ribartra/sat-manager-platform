/* eslint-disable @typescript-eslint/no-require-imports */ // node docs/qa/figure-audit-20261005/image-history.cjs <older.db> <newer.db> [out.json]
// Read-only: questions that had an imageUrl in the older snapshot and have none in the newer one.
const Database = require(process.env.BSQ || "better-sqlite3");
const [older, newer, out] = process.argv.slice(2);
const load = (p) => new Map(new Database(p, { readonly: true }).prepare("select id, imageUrl from Question").all().map((r) => [r.id, r.imageUrl]));
const a = load(older);
const b = load(newer);
const lost = [...b].filter(([id, url]) => !url && a.get(id)).map(([id]) => ({ id, previous: a.get(id) }));
const changed = [...b].filter(([id, url]) => url && a.get(id) && a.get(id) !== url).length;
console.log(JSON.stringify({ older: a.size, newer: b.size, lost: lost.length, changed }));
if (out) require("fs").writeFileSync(out, JSON.stringify(lost, null, 1));
