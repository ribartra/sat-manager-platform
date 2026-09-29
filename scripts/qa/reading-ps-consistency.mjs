// Read-only consistency audit of the READING Practice Sets (18 sets / 529 Q) against their
// source PDFs (exercise + ANS, both with a text layer and "Question ID: <hex>").
// Checks per question: order vs source, key vs ANS, "Choice X is the best answer" in the
// explanation vs key, options letter-by-letter (permutations), stem/stimulus/explanation
// vs its own hex block (neighbour bleed / truncation), taxonomy + metadata, UI/placeholder leaks.
// Usage: node scripts/qa/reading-ps-consistency.mjs [dev.db] [out.json]
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { resolveReadingPracticeSets } from "./practice-common.mjs";

const dbPath = process.argv[2] || "dev.db";
const outPath = process.argv[3] || "docs/qa/practice/reading-consistency.json";
const db = new Database(dbPath, { readonly: true });
const sets = resolveReadingPracticeSets(db);

const pdfText = (p) => execFileSync("pdftotext", [p, "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
const HEX = /Question ID:?\s*([0-9a-f]{8})\b/gi;
function blocks(p) {
  const txt = pdfText(p);
  const hits = [...txt.matchAll(HEX)];
  return hits.map((m, i) => ({ hex: m[1].toLowerCase(), text: txt.slice(m.index + m[0].length, hits[i + 1]?.index ?? txt.length) }));
}
const words = (s) => new Set((s || "").toLowerCase().normalize("NFKD").replace(/\+\+|\*\*|\*|_{2,}/g, " ").match(/[a-z0-9]{3,}/g) || []);
const cover = (a, b) => { const A = words(a); if (!A.size) return null; const B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / A.size; };
function srcOptions(text) {
  const body = text.split(/\n\s*Answer\s*\n/)[1] ?? text;
  const cut = body.split(/\n\s*(?:Correct Answer|Rationale|ID:|Question Difficulty)/)[0];
  const out = {};
  const re = /(?:^|\n)\s*([ABCD])\.\s+([\s\S]*?)(?=\n\s*[ABCD]\.\s+|$)/g;
  let m;
  while ((m = re.exec(cut))) out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  return out;
}
const LEAK = /[■□☒✕✗☑]|COME BACK LATER|NEXT QUESTION|PREV\.? QUESTION|\[tbl-\d|img-\d+\.jpe?g|Question ID|Question Difficulty|\[[^\]\n]{2,40} \/ [^\]\n]{2,40}\]/;

const report = [];
const seenQ = new Map();
for (const s of sets) {
  const ex = s.exercisePdf ? blocks(s.exercisePdf) : [];
  const ans = s.ansPdf ? blocks(s.ansPdf) : [];
  const exByHex = new Map(ex.map((b) => [b.hex, b]));
  const ansByHex = new Map(ans.map((b) => [b.hex, b]));
  const srcOrder = [...new Set(ex.map((b) => b.hex))];
  const setTopic = db.prepare("select topicId, difficulty from PracticeSet where id=?").get(s.setId);
  const domainName = s.domain;
  const expectedName = new RegExp(`^${domainName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} - ${s.topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} - ${s.difficulty}( - #\\d+)?$`);
  const setFlags = [];
  if (!expectedName.test(s.name)) setFlags.push(`set name "${s.name}" does not match domain/skill/level`);
  if (!ex.length) setFlags.push("exercise PDF not parsed");
  if (!ans.length) setFlags.push("ANS PDF not parsed");
  const dbOrder = s.questions.map((q) => (q.externalId || "").toLowerCase());
  const missingInSrc = dbOrder.filter((h) => h && !exByHex.has(h));
  const missingInDb = srcOrder.filter((h) => !dbOrder.includes(h));
  if (missingInDb.length) setFlags.push(`source questions not in set: ${missingInDb.join(",")}`);
  const srcPos = new Map(srcOrder.map((h, i) => [h, i]));

  s.questions.forEach((q, i) => {
    const f = [];
    const hex = (q.externalId || "").toLowerCase();
    const src = exByHex.get(hex);
    const an = ansByHex.get(hex);
    const qrow = db.prepare("select topicId, difficulty, status, imageUrl from Question where id=?").get(q.qid);
    if (seenQ.has(q.qid)) f.push(`duplicate: also in set ${seenQ.get(q.qid)}`);
    seenQ.set(q.qid, s.name);
    // 1 order
    if (!hex) f.push("no hex");
    else if (!src) f.push("hex not found in exercise PDF");
    else {
      const rank = [...s.questions].filter((x) => srcPos.has((x.externalId || "").toLowerCase()))
        .sort((a, b) => srcPos.get(a.externalId.toLowerCase()) - srcPos.get(b.externalId.toLowerCase()))
        .findIndex((x) => x.qid === q.qid);
      if (rank !== i) f.push(`order: position ${i + 1}, source position ${rank + 1}`);
    }
    // 2 key
    const ansKey = an ? (an.text.match(/Correct Answer:?\s*([ABCD])\b/) || [])[1] : null;
    if (!an) f.push("hex not found in ANS");
    else if (!ansKey) f.push("no Correct Answer in ANS block");
    else if (ansKey !== q.correctAnswer) f.push(`key: stored ${q.correctAnswer} != ANS ${ansKey}`);
    const explChoice = (q.explanation || "").match(/Choice\s+([ABCD])\s+is\s+the\s+best\s+answer/);
    if (explChoice && explChoice[1] !== q.correctAnswer) f.push(`explanation says Choice ${explChoice[1]} is best, key ${q.correctAnswer}`);
    // 3 options
    if (src) {
      const so = srcOptions(src.text);
      const opts = Object.fromEntries(q.options.map((o) => [o.label, o.text]));
      if (q.options.length !== 4) f.push(`options: ${q.options.length}`);
      for (const L of ["A", "B", "C", "D"]) {
        if (!so[L] || !opts[L]) continue;
        const c = cover(so[L], opts[L]);
        if (c !== null && c < 0.8) {
          const other = ["A", "B", "C", "D"].filter((K) => K !== L && opts[K] && (cover(so[L], opts[K]) ?? 0) >= 0.9);
          f.push(other.length ? `option_permutation: source ${L} matches stored ${other}` : `option_mismatch ${L} (${c.toFixed(2)}): src "${so[L].slice(0, 50)}" vs "${opts[L].slice(0, 50)}"`);
        }
      }
    }
    // 4 content vs own block and neighbours
    if (src) {
      const content = `${q.stimulus || ""} ${q.stem || ""}`;
      const own = cover(content, src.text);
      if (own !== null && own < 0.85) {
        const best = ex.filter((b) => b.hex !== hex).map((b) => ({ hex: b.hex, c: cover(content, b.text) })).sort((a, b) => b.c - a.c)[0];
        f.push(`content_vs_source ${own.toFixed(2)}` + (best && best.c > own ? ` (better match ${best.hex} ${best.c.toFixed(2)})` : ""));
      }
      const back = cover(src.text.split(/\n\s*Answer\s*\n/)[0], content);
      if (back !== null && back < 0.85) f.push(`source_passage_missing_in_db ${back.toFixed(2)}`);
      if (an && q.explanation) {
        const rat = an.text.split(/Rationale/i)[1] || "";
        const ce = cover(q.explanation, rat);
        if (rat && ce !== null && ce < 0.8) f.push(`explanation_vs_rationale ${ce.toFixed(2)}`);
      }
    }
    if (/Cross-Text/.test(s.topic) && !(/Text 1/.test(q.stimulus || q.stem) && /Text 2/.test(q.stimulus || q.stem))) f.push("cross-text: Text 1/Text 2 missing");
    if (qrow.imageUrl && !fs.existsSync(`public${qrow.imageUrl}`)) f.push(`image file missing ${qrow.imageUrl}`);
    // 5 taxonomy/metadata/leaks
    if (qrow.topicId !== setTopic.topicId) f.push(`topicId ${qrow.topicId} != set ${setTopic.topicId}`);
    if (qrow.difficulty !== setTopic.difficulty) f.push(`difficulty ${qrow.difficulty} != set ${setTopic.difficulty}`);
    if (qrow.status !== "PUBLISHED") f.push(`status ${qrow.status}`);
    if (!q.explanation || !q.explanation.trim()) f.push("explanation empty");
    for (const [k, v] of [["stem", q.stem], ["stimulus", q.stimulus], ["explanation", q.explanation], ...q.options.map((o) => [`opt ${o.label}`, o.text])]) {
      const m = (v || "").match(LEAK);
      if (m) f.push(`leak in ${k}: "${m[0]}"`);
    }
    report.push({ set: s.name, pos: i + 1, qid: q.qid, hex, key: q.correctAnswer, ansKey, flags: f });
  });
  if (setFlags.length) report.push({ set: s.name, pos: 0, qid: null, flags: setFlags });
}
fs.writeFileSync(outPath, JSON.stringify(report, null, 1));
const flagged = report.filter((r) => r.flags.length);
const kinds = {};
for (const r of flagged) for (const fl of r.flags) { const k = fl.split(/[: (]/)[0]; kinds[k] = (kinds[k] || 0) + 1; }
console.log(`sets=${sets.length} questions=${report.filter((r) => r.qid).length} flagged=${flagged.length}`);
console.log(kinds);
