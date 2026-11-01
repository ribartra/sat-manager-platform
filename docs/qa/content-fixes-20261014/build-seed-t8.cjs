/* eslint-disable @typescript-eslint/no-require-imports */ // run from the repo root: node docs/qa/content-fixes-20261014/build-seed-t8.cjs
// TEST 8 Math M1 #4/#6, the two cases from the reviewer's screenshots. Source: TEST 8 INNOV MATH MOD 1&2.pdf pages 2-3.
const D = require(process.env.BSQ || "better-sqlite3");
const db = new D(process.argv[2] || "dev.db", { readonly: true });
const stem = (id) => db.prepare("select stem from Question where id = ?").get(id).stem;
const q4 = "cmsnb3fyo000a0mpdhp76a4hs", q6 = "cmsnb3fz8000f0mpdhil7l0kw";
const ops = [
  { table: "Question", id: q4, field: "stem", before: stem(q4),
    after: stem(q4).replace(/\n\n× A\n\n\$\$\\sqrt\{35\}\$\$\n\n× B$/, ""),
    note: "T8 Math M1 #4: options_in_stem — '× A √35 × B' (player cross-out UI + option A) pasted into the stem",
    class: "options_in_stem", evidence: "IngestPageArtifact page 2 OCR: options follow 'NEXT QUESTION' as × A..× D; real options A-D present" },
  { table: "Question", id: q6, field: "stem", before: stem(q6),
    after: "| Week | Bank Account |\n| --- | --- |\n| 1 | $200 |\n| 2 | $225 |\n| 3 | $250 |\n| 4 | $275 |\n| 5 | $300 |\n\nThe table shows how much money is in Aditya's bank account over time. Based on the table, how much money, in dollars, will Aditya have in his bank account on week 7?",
    note: "T8 Math M1 #6: flattened_table — Week/Bank Account table flattened into the sentence",
    class: "flattened_table", evidence: "source PDF page 3: table Week | Bank Account, 1-5 → $200..$300 above the question" },
];
for (const o of ops) if (o.before === o.after) throw new Error("no change " + o.id);
process.stdout.write(JSON.stringify(ops, null, 1) + "\n");
