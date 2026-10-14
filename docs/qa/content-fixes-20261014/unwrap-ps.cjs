/* eslint-disable @typescript-eslint/no-require-imports */ // run from the repo root: node docs/qa/content-fixes-20261014/<file>
// Join PDF hard line wraps in practice-set questions (whitespace-only, read-only on the DB).
// Usage: node unwrap-ps.cjs <db> <out-spec.json> <domain>[,<domain>…]
// Writes guarded ops (table/id/field/before/after) and <out>-review.json with mid-sentence breaks it left alone.
const Database = require(process.env.BSQ || "better-sqlite3");
const fs = require("fs");
const [dbPath, out, domainArg] = process.argv.slice(2);
const domains = domainArg.split(",");
const db = new Database(dbPath, { readonly: true });

const WRAP_MIN = 110; // the ANS text column is ~130-155 chars
const SHORT = 90;
const VERSE = !domains.some((d) => /Algebra|Advanced Math|Geometry|Problem-Solving/.test(d)); // poems only in R&W
// A line with fewer than 3 plain words (outside $…$ / *…*) is an equation or list item, never a prose wrap.
const plainWords = (l) => l.replace(/\$[^$]*\$/g, " ").replace(/\*[^*]*\*/g, " ").split(/\s+/).filter((w) => /^[A-Za-z’'-]{2,}[.,;:?]?$/.test(w)).length;
const isTable = (l) => /^\s*\|.*\|\s*$/.test(l);
const isProtectedStart = (l) =>
  !l.trim() ||
  isTable(l) ||
  /\$\$/.test(l) ||
  /^\s*[-•]\s/.test(l) ||
  /^\s*(I{1,3}|IV|V)\.\s/.test(l) ||
  /^\s*(Text [12]|Choices? [A-D](,|\b)|Question ID|Question Difficulty|Step \d|Finding:)/.test(l);
const isProtectedEnd = (l) => !l.trim() || isTable(l) || /\$\$/.test(l) || /^\s*(Text [12])\s*$/.test(l) || plainWords(l) < 3;

function unwrap(text) {
  const lines = text.split("\n");
  // Notes lists (one note per line) and verse (3+ consecutive short lines) keep their breaks.
  const keep = new Array(lines.length).fill(false);
  let inNotes = false;
  for (let i = 0; i < lines.length; i++) {
    if (/following notes:\s*$/.test(lines[i])) { inNotes = true; continue; }
    if (inNotes) { if (!lines[i].trim()) inNotes = false; else keep[i] = true; }
  }
  for (let i = 0; VERSE && i + 2 < lines.length; i++) {
    const run = [i, i + 1, i + 2].every((j) => lines[j].trim() && lines[j].length < SHORT && !isTable(lines[j]) && !/\$\$/.test(lines[j]));
    if (run) keep[i] = keep[i + 1] = keep[i + 2] = true;
  }
  const proseLens = lines.filter((l) => l.trim() && !isTable(l) && !/\$\$/.test(l)).map((l) => l.length);
  const maxLen = Math.max(0, ...proseLens);
  // Only mid-sentence breaks are joined: a line that ends a sentence keeps its break (it may end a paragraph).
  const isWrap = (prev) =>
    !/[.!?]["”’)]?\s*$/.test(prev) &&
    (prev.length >= WRAP_MIN || (maxLen >= 30 && prev.length >= 0.75 * maxLen && !/[:;"”’)\]]\s*$/.test(prev)));
  const outLines = [lines[0]];
  const review = [];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const cur = lines[i];
    const joinable =
      !keep[i - 1] && !keep[i] && !isProtectedEnd(prev) && !isProtectedStart(cur) && isWrap(prev) &&
      // an equation-like line (few plain words) after a finished sentence or a colon starts its own line
      !(plainWords(cur) < 3 && /[.:?!]\s*$/.test(prev)) &&
      // numbered list items ("1. …") start their own line after a finished sentence, a colon or another item
      !(/^\s*\d{1,2}[.)]\s/.test(cur) && (/[.:?!]\s*$/.test(prev) || /^\s*\d{1,2}[.)]\s/.test(prev)));
    if (joinable) {
      const tail = outLines.pop();
      const noSpace = /[A-Za-z]-$/.test(tail) || /—$/.test(tail) || /^—/.test(cur);
      outLines.push(tail.replace(/\s+$/, "") + (noSpace ? "" : " ") + cur.replace(/^\s+/, ""));
    } else {
      if (prev.trim() && cur.trim() && !isProtectedStart(cur) && !isProtectedEnd(prev) && !/[.!?:;"”’)\]]\s*$/.test(prev) && /^[a-z(“‘"$0-9—–-]/.test(cur.trim()))
        review.push({ line: prev.slice(-60), next: cur.slice(0, 60), reason: keep[i - 1] || keep[i] ? "kept-block" : "short-line" });
      outLines.push(cur);
    }
  }
  return { after: outLines.join("\n"), review };
}

const rows = db.prepare(`
  SELECT q.id, q.stem, q.stimulus, q.explanation, d.name dom, ps.name ps, psq."order" ord
  FROM Question q JOIN PracticeSetQuestion psq ON psq.questionId = q.id JOIN PracticeSet ps ON ps.id = psq.practiceSetId
  JOIN Topic t ON t.id = ps.topicId JOIN Domain d ON d.id = t.domainId`).all().filter((r) => domains.includes(r.dom));
const optStmt = db.prepare("SELECT id, label, text FROM QuestionOption WHERE questionId = ? ORDER BY label");
const ops = [];
const review = [];
const squash = (s) => s.replace(/\s+/g, "");
const add = (table, id, field, before, where) => {
  if (!before || !before.includes("\n")) return;
  const r = unwrap(before);
  if (r.review.length) review.push({ id, field, where, items: r.review });
  if (r.after === before) return;
  if (squash(r.after) !== squash(before)) throw new Error(`non-whitespace change ${id} ${field}`);
  ops.push({ table, id, field, before, after: r.after, class: "pdf_hard_wrap", note: `${where}: joined PDF line wraps (whitespace only)` });
};
for (const r of rows) {
  const where = `${r.ps} #${r.ord}`;
  for (const f of ["stem", "stimulus", "explanation"]) add("Question", r.id, f, r[f], where);
  for (const o of optStmt.all(r.id)) add("QuestionOption", o.id, "text", o.text, `${where} opt ${o.label}`);
}
fs.writeFileSync(out, JSON.stringify(ops, null, 1));
fs.writeFileSync(out.replace(/\.json$/, "-review.json"), JSON.stringify(review, null, 1));
const byField = {};
for (const o of ops) byField[o.field] = (byField[o.field] || 0) + 1;
console.log(JSON.stringify({ questions: rows.length, ops: ops.length, byField, reviewFields: review.length, reviewItems: review.reduce((n, r) => n + r.items.length, 0) }));
