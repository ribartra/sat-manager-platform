// Repara Questions promovidas usando SU IngestQuestionCandidate (officialQuestionId).
// Estrategias (solo datos, sin re-OCR):
//   A) NUMERIC mal tipada / MC sin opciones, pero el candidate tiene >=4 opciones de TEXTO
//      -> type=MC, reemplaza opciones con las de staging, correctAnswer=letra.
//   C) image-backed (Question.imageUrl presente) con respuesta-letra y sin opciones de texto
//      -> type=MC, andamia 4 botones A-D (text=""), correctAnswer=letra.
//   Siempre: normaliza correctAnswer con letra final ("3. B" -> "B") en MC.
// NO toca E/F (sin imagen ni opciones en ningún lado -> requieren re-OCR).
//
// Corre con el dev server DETENIDO (escrituras externas a dev.db en WAL lo corrompen).
// Uso: DATABASE_URL=file:./dev.db node scripts/repair-questions-from-staging.mjs [--apply]
import Database from "better-sqlite3";
import crypto from "crypto";

const url = process.env.DATABASE_URL || "file:./dev.db";
const apply = process.argv.includes("--apply");
const db = new Database(url.startsWith("file:") ? url.slice(5) : url);
const LABELS = ["A", "B", "C", "D"];
const parseOpts = (j) => { try { const a = JSON.parse(j); return Array.isArray(a) ? a : []; } catch { return []; } };
const textN = (arr) => arr.filter((o) => o && typeof o.text === "string" && o.text.trim()).length;
const letterFrom = (s) => { const m = (s || "").trim().match(/([A-D])\s*$/i); return m ? m[1].toUpperCase() : null; };

const qs = db.prepare(`
  SELECT q.id, q.type, q.correctAnswer, q.imageUrl,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id) nOpts,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.text IS NOT NULL AND o.text<>'') nText,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.imageUrl IS NOT NULL) nOptImg
  FROM Question q
`).all();
const candStmt = db.prepare("SELECT id, optionsJson, correctAnswer, contentType FROM IngestQuestionCandidate WHERE officialQuestionId=?");

// Devuelve un plan de reparación o null.
function plan(q) {
  const c = candStmt.get(q.id);
  if (!c) return null;
  const cOpts = parseOpts(c.optionsJson);
  const cText = textN(cOpts);
  const letter = letterFrom(c.correctAnswer) || letterFrom(q.correctAnswer);
  const hasImg = !!q.imageUrl || q.nOptImg > 0;
  const ct = c.contentType || "?";

  // A) staging trae >=4 opciones de TEXTO -> asegurar MC con opciones de texto.
  //    Si la Question YA tiene 4 opciones de texto, no reimportar (solo normalizar/re-tipar).
  if (cText >= 4 && letter) {
    const keepOpts = q.nText >= 4; // ya tiene opciones de texto en la Question
    const already = q.type === "MC" && q.nText >= 4 && (q.correctAnswer || "").trim() === letter;
    return {
      strat: keepOpts ? "B_normalize_answer" : "A_text_options", ct, already,
      type: "MC", correctAnswer: letter,
      options: keepOpts ? null : LABELS.map((L) => {
        const o = cOpts.find((x) => (x.label || x.letter || "").toUpperCase() === L);
        return { label: L, text: (o && typeof o.text === "string") ? o.text : "", imageUrl: null };
      }),
    };
  }

  // C) image-backed con respuesta-letra pero sin opciones de texto -> andamiar botones A-D
  if (hasImg && letter && q.nText < 4) {
    const already = q.type === "MC" && q.nOpts >= 4 && (q.correctAnswer || "").trim() === letter;
    return {
      strat: "C_scaffold_buttons", ct, already,
      type: "MC", correctAnswer: letter,
      options: LABELS.map((L) => ({ label: L, text: "", imageUrl: null })),
    };
  }

  return null; // E/F -> requiere re-OCR/manual
}

const counts = {};
const plans = [];
for (const q of qs) {
  const p = plan(q);
  if (!p) continue;
  plans.push({ q, p });
  const key = `${p.strat}${p.already ? " (ya OK)" : ""}`;
  counts[key] = (counts[key] || 0) + 1;
}

console.log("=== Plan de reparación ===");
for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k}: ${v}`);
const toChange = plans.filter((x) => !x.p.already);
console.log(`\n  Total con plan: ${plans.length} | a modificar: ${toChange.length} | ya OK: ${plans.length - toChange.length}`);

// desglose full-test vs practice de lo que se modifica
const byCt = {};
for (const x of toChange) { const k = `${x.p.strat}/${x.p.ct}`; byCt[k] = (byCt[k] || 0) + 1; }
console.log("  Por contentType (a modificar):");
for (const [k, v] of Object.entries(byCt).sort()) console.log(`    ${k}: ${v}`);

if (!apply) { console.log("\n(dry-run; pasa --apply para escribir)"); db.close(); process.exit(0); }

const now = new Date().toISOString().replace("Z", "+00:00");
const delOpts = db.prepare("DELETE FROM QuestionOption WHERE questionId=?");
const insOpt = db.prepare("INSERT INTO QuestionOption (id, questionId, label, text, imageUrl) VALUES (?,?,?,?,?)");
const updQ = db.prepare("UPDATE Question SET type=?, correctAnswer=?, updatedAt=? WHERE id=?");

const tx = db.transaction(() => {
  for (const { q, p } of toChange) {
    if (p.options) {
      delOpts.run(q.id);
      for (const o of p.options) insOpt.run(`opt_${crypto.randomUUID()}`, q.id, o.label, o.text, o.imageUrl);
    }
    updQ.run(p.type, p.correctAnswer, now, q.id);
  }
});
tx();

console.log(`\nAPLICADO. Questions modificadas: ${toChange.length}.`);
db.close();
