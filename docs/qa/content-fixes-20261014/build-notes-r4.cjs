/* eslint-disable @typescript-eslint/no-require-imports */ // run from the repo root: node docs/qa/content-fixes-20261014/build-notes-r4.cjs > specs/notes-r4.json
// Round 4: notes-question intros cropped in the source (T7 R&W M1 #26, T10 R&W M1 #24), 9 notes lists still on one line
// (T2/T3), and T10 R&W M2 #9 Text 2 ending in ";" (source typo).
const D = require(process.env.BSQ || "better-sqlite3");
const db = new D(process.argv[2] || "dev.db", { readonly: true });
const INTRO = "While researching a topic, a student has taken the following notes:";
const find = (t, m, n) => db.prepare(`select qu.id, qu.stimulus s from FullPracticeTestQuestion q join FullPracticeTestModule m on m.id=q.moduleId join FullPracticeTest t on t.id=m.testId join Question qu on qu.id=q.questionId where t.name=? and m.name like ? and q."order"=?`).get(t, m, n - 1);
const ops = [];
for (const [t, m, n, tag] of [["TEST 7", "Reading%Module 1", 26, "T7 R&W M1 #26"], ["TEST 10", "Reading%Module 1", 24, "T10 R&W M1 #24"]]) {
  const q = find(t, m, n);
  if (!/^notes:\n+- /.test(q.s)) throw new Error(tag + " unexpected start");
  ops.push({ table: "Question", id: q.id, field: "stimulus", before: q.s, after: q.s.replace(/^notes:\n+/, INTRO + "\n"),
    note: `${tag}: other — source screenshot cropped above "notes:"; standard intro sentence restored`, class: "other", evidence: "source page cropped at top; same intro as the 48 other notes questions" });
}
const flat = db.prepare(`select qu.id, qu.stimulus s, t.name t, m.name m, q."order"+1 n from FullPracticeTestQuestion q join FullPracticeTestModule m on m.id=q.moduleId join FullPracticeTest t on t.id=m.testId join Question qu on qu.id=q.questionId where qu.stimulus like ?`).all(INTRO + " - %");
for (const q of flat) {
  const after = q.s.replace(INTRO + " - ", INTRO + "\n- ").replace(/ - (?=\S)/g, "\n- ");
  if (after.replace(/\n- /g, " - ").replace(INTRO + " - ", INTRO + " - ") !== q.s) throw new Error("text changed " + q.id);
  ops.push({ table: "Question", id: q.id, field: "stimulus", before: q.s, after,
    note: `${q.t.replace("TEST ", "T")} ${q.m.replace("Reading & Writing Module ", "R&W M")} #${q.n}: other — notes bullets on one line; one bullet per line (text identical)`, class: "other", evidence: "source page: bulleted list" });
}
const t9 = find("TEST 10", "Reading%Module 2", 9);
if (!t9.s.endsWith("too good to be true;")) throw new Error("T10 M2 #9 unexpected end");
ops.push({ table: "Question", id: t9.id, field: "stimulus", before: t9.s, after: t9.s.replace(/;$/, "."),
  note: "T10 R&W M2 #9: other — Text 2 ends with ';' (source typo); end with '.'", class: "other", evidence: "source page 23: text complete, ends with ';'" });
process.stdout.write(JSON.stringify(ops, null, 1) + "\n");
