// READONLY. Clasifica cada Question rota por su ESTRATEGIA de reparación real,
// cruzando con el IngestQuestionCandidate (officialQuestionId) y con las imágenes
// (Question.imageUrl / QuestionOption.imageUrl / IngestCandidateImageLink STEM).
import Database from "better-sqlite3";
const db = new Database("./dev.db", { readonly: true });
const AD = new Set(["A", "B", "C", "D"]);
const parseOpts = (j) => { try { const a = JSON.parse(j); return Array.isArray(a) ? a : []; } catch { return []; } };
const textN = (arr) => arr.filter((o) => o && typeof o.text === "string" && o.text.trim()).length;
// respuesta con letra al final: "3. B", "B", "Answer: C" -> letra
const letterFromAns = (s) => { const m = (s || "").trim().match(/([A-D])\s*$/i); return m ? m[1].toUpperCase() : null; };

const qs = db.prepare(`
  SELECT q.id, q.type, q.correctAnswer, q.stem, q.imageUrl,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id) nOpts,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.text IS NOT NULL AND o.text<>'') nText,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.imageUrl IS NOT NULL) nOptImg
  FROM Question q
`).all();
const cand = db.prepare("SELECT id, type, optionsJson, correctAnswer, contentType FROM IngestQuestionCandidate WHERE officialQuestionId=?");
const stemLinks = db.prepare("SELECT count(*) c FROM IngestCandidateImageLink WHERE candidateId=? AND targetType IN ('STEM','STIMULUS')");

function brokenKind(q) {
  const hasImg = !!q.imageUrl || q.nOptImg > 0;
  const ca = (q.correctAnswer || "").trim();
  if (q.type === "NUMERIC" && AD.has(ca)) return "mistyped-numeric";
  if (q.type === "NUMERIC" && ca && !/[0-9]/.test(ca)) return "numeric-invalid";
  if (q.type === "MC") {
    if (q.nOpts === 0 && !hasImg) return "mc-no-options";
    if (q.nText < 4 && hasImg) return "mc-options-in-image";
    if (q.nText < 4) return "mc-incomplete-options";
    if (ca && !AD.has(ca)) return "mc-answer-not-ad";
  }
  return null;
}

const strat = {}; // strategy -> count
const bump = (s) => (strat[s] = (strat[s] || 0) + 1);
const perContent = {}; // strategy -> {PRACTICE_SET, FULL_PRACTICE_TEST}

for (const q of qs) {
  const kind = brokenKind(q);
  if (!kind) continue;
  const c = cand.get(q.id);
  const cOpts = c ? parseOpts(c.optionsJson) : [];
  const cText = textN(cOpts);
  const cLetter = c ? letterFromAns(c.correctAnswer) : null;
  const hasQImg = !!q.imageUrl;
  const hasStemLink = c ? stemLinks.get(c.id).c > 0 : false;
  const ct = c?.contentType || "?";

  let s;
  // 1) staging tiene 4 opciones de TEXTO reales -> import + (re-tipar si NUMERIC)
  if (cText >= 4) s = kind === "mistyped-numeric" ? "A_retype+text_options" : "A_import_text_options";
  // 2) respuesta con letra pegada/leak pero ya hay 4 opciones de texto en la Question -> normalizar respuesta
  else if (kind === "mc-answer-not-ad" && q.nText >= 4 && letterFromAns(q.correctAnswer)) s = "B_normalize_answer";
  // 3) image-backed: la Question YA tiene imagen de stem -> andamiar botones A-D (+re-tipar/normalizar answer)
  else if ((hasQImg || q.nOptImg > 0) && cLetter) s = "C_scaffold_buttons(has_img)";
  // 4) image-backed: NO tiene imagen en Question pero SÍ hay link STEM en staging -> promover imagen + andamiar
  else if (hasStemLink && cLetter) s = "D_promote_stem_img+scaffold";
  // 5) tiene letra de respuesta pero ni imagen ni opciones en ningún lado -> re-OCR opciones
  else if (cLetter) s = "E_needs_ocr_options(no_img,no_opts)";
  // 6) respuesta numérica basura / prosa -> re-OCR o manual
  else s = "F_needs_ocr_or_manual";

  bump(s);
  (perContent[s] ??= {})[ct] = (perContent[s]?.[ct] || 0) + 1;
}

console.log("=== Estrategia de reparación (por Question rota) ===\n");
const order = ["A_retype+text_options","A_import_text_options","B_normalize_answer","C_scaffold_buttons(has_img)","D_promote_stem_img+scaffold","E_needs_ocr_options(no_img,no_opts)","F_needs_ocr_or_manual"];
let repairable = 0, ocr = 0;
for (const s of order) {
  if (!strat[s]) continue;
  const by = Object.entries(perContent[s] || {}).map(([k, v]) => `${k}:${v}`).join(" ");
  console.log(`  ${s}: ${strat[s]}   (${by})`);
  if (s.startsWith("E_") || s.startsWith("F_")) ocr += strat[s]; else repairable += strat[s];
}
console.log(`\n  => reparables desde staging/código (A-D): ${repairable}`);
console.log(`  => requieren re-OCR/manual (E-F): ${ocr}`);
db.close();
