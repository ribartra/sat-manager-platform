#!/usr/bin/env node
/**
 * Fase 3 (DRY-RUN por defecto): calcula el patch sobre candidatos PRACTICE_SET y
 * genera incidences.csv, SIN escribir en la BD salvo que se pase --apply.
 * Alcance de-riesgado: NO toca skill/domain (la carpeta es autoritativa).
 *  - section RW -> READING_WRITING (nombre oficial)
 *  - correctAnswer backfill desde ANS (parser por tipo) + validación vs opciones
 *  - explanation vacía <- rationale
 *  - escaneo/limpieza de contenido incoherente en stem/opciones/explanation
 *  - subskillName = NULL
 * MOCK EXAMS (FULL_PRACTICE_TEST) no se tocan.
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const META = process.env.ANS_META || "/tmp/claude-1000/-home-turista-Descargas-Github-sat-manager-platform/2e6ab720-85cc-4491-b237-6d268296bdbf/scratchpad/ans_metadata.json";
const CSV = path.join(ROOT, "scripts/ingest_patch/incidences.csv");

const meta = JSON.parse(fs.readFileSync(META, "utf8"));
const db = new Database(path.join(ROOT, "dev.db"), { readonly: !APPLY });

const cands = db.prepare(
  `SELECT id, questionExternalId qid, contentType, section, domainName, topicName, subskillName,
          difficulty, type, stem, stimulus, optionsJson, correctAnswer, explanation
   FROM "IngestQuestionCandidate" WHERE contentType='PRACTICE_SET'`
).all();
const withImage = new Set(
  db.prepare(`SELECT DISTINCT candidateId c FROM "IngestCandidateImageLink"`).all().map((r) => r.c)
);

// ---------- helpers ----------
const MD_IMG = /!\[[^\]]*\]\([^)]*\)/g;
const ID_LINE = /^\s*(?:question\s+)?id\s*:?\s*[0-9a-f]{6,}\s*$/gim;
const ID_INLINE = /\b(?:question\s+)?id\s*:?\s*[0-9a-f]{6,}\b/gi;
const HEADER_LEAK = /^\s*(assessment test\s+domain\s+skill\s+difficulty|sat (?:math|reading and writing)\b.*)$/gim;
const MOJIBAKE = /[�]|Ã.|â€|Â[^\s]/;

// Limpieza rutinaria (silenciosa): ID leak, header bleed, markdown de imagen y
// whitespace — son artefactos sistemáticos de extracción. `mojibake` sí es raro y
// se marca en el CSV (indica problema de encoding a revisar).
function cleanText(v) {
  const before = v ?? "";
  const mojibake = MOJIBAKE.test(before);
  let s = before.replace(MD_IMG, "").replace(HEADER_LEAK, "").replace(ID_LINE, "").replace(ID_INLINE, "");
  s = s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return { text: s, routine: s !== before, mojibake };
}

function parseOptions(json) {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; }
}

// respuesta autoritativa del ANS: ya viene robustecida por extract_correct_answer
// (ingest_service). MC = letra A-D; NUMERIC = número o lista ("11, -7").
function ansAnswer(m, type) {
  if (!m || !m.correctAnswer) return null;
  const raw = String(m.correctAnswer).trim();
  if (type === "MC") return /^[A-D]$/i.test(raw) ? raw.toUpperCase() : null;
  return raw;
}
const normNum = (s) => String(s ?? "").replace(/\s+/g, "").replace(/−/g, "-");

// ---------- CSV ----------
const rows = [["candidateId","questionExternalId","section","domain","skill","incidence_type","field","action","original","proposed","sourcePdf"]];
const q = (v) => `"${String(v ?? "").replace(/"/g,'""').replace(/\r?\n/g," ").slice(0,300)}"`;
function inc(c, type, field, action, original, proposed, src) {
  rows.push([c.id, c.qid, c.section, c.domainName, c.topicName, type, field, action, original, proposed, src].map(q).join(","));
}

// ---------- recorrer ----------
const stats = { total: cands.length, matched: 0, sectionFix: 0, answerFill: 0, answerFix: 0, answerMismatch: 0,
  optionsFixed: 0, explClean: 0, explFill: 0, explMissing: 0, routineStem: 0, routineOpt: 0, anomalies: 0, emptyOpt: 0, dupOpt: 0, mcNoAns: 0, figNoImg: 0, subskillClear: 0 };
const updates = [];

for (const c of cands) {
  const m = meta[c.qid]; if (m) stats.matched++;
  const set = {};

  // 1) section normalizada (cambio seguro aplicado; no va al CSV de revisión)
  if (c.section === "RW") { set.section = "READING_WRITING"; stats.sectionFix++; }

  // 2) subskill NULL
  if (c.subskillName != null) { set.subskillName = null; stats.subskillClear++; }

  // 3) opciones y respuesta
  let opts = parseOptions(c.optionsJson);
  let labels = opts.map((o) => String(o.label ?? "").trim().toUpperCase());
  // 3a) opciones MC malformadas (labels != ABCD) -> reemplazar con las limpias del ANS
  if (c.type === "MC" && labels.join("") !== "ABCD" && Array.isArray(m?.ansOptions) && m.ansOptions.length === 4) {
    opts = m.ansOptions.map((o) => ({ label: String(o.label).toUpperCase(), text: o.text, imageUrl: null }));
    labels = opts.map((o) => o.label);
    set.optionsJson = JSON.stringify(opts);
    stats.optionsFixed++; inc(c, "OPTIONS_FIXED_FROM_ANS", "optionsJson", "fix", c.optionsJson, set.optionsJson, m?.sourcePdf);
  }
  const cur = String(c.correctAnswer ?? "").trim();
  const ans = ansAnswer(m, c.type);
  if (c.type === "MC") {
    const curOk = cur && labels.includes(cur.toUpperCase());
    if (!curOk) {
      if (ans && labels.includes(ans)) { set.correctAnswer = ans; (cur ? stats.answerFix++ : stats.answerFill++); inc(c, cur ? "MC_ANSWER_FIXED":"MC_ANSWER_FILLED","correctAnswer","fix",cur,ans,m?.sourcePdf); }
      else { stats.mcNoAns++; inc(c,"MC_ANSWER_UNRESOLVED","correctAnswer","flag",cur, ans||"", m?.sourcePdf); }
    } else if (ans && ans !== cur.toUpperCase() && labels.includes(ans)) { set.correctAnswer = ans; stats.answerFix++; inc(c,"MC_ANSWER_CORRECTED_FROM_ANS","correctAnswer","fix",cur,ans,m?.sourcePdf); }
  } else { // NUMERIC
    const curNumericBad = cur && !/^[-+]?\d/.test(cur); // ej. candidato con "A" en NUMERIC
    if ((!cur || curNumericBad) && ans) { set.correctAnswer = ans; stats.answerFill++; inc(c,"NUMERIC_ANSWER_FILLED","correctAnswer","fix",cur,ans,m?.sourcePdf); }
    else if (cur && ans && normNum(cur) !== normNum(ans)) { stats.answerMismatch++; inc(c,"NUMERIC_ANSWER_MISMATCH_ANS","correctAnswer","flag",cur,ans,m?.sourcePdf); }
  }

  // 4) explanation: el campo es el volcado COMPLETO de la página ANS. Extraer solo
  //    el Rationale (texto real de la explicación), no truncado.
  const expl = c.explanation || "";
  const ri = expl.search(/\bRationale\b/i);
  if (ri !== -1) {
    let r = expl.slice(ri + "Rationale".length).split(/Question\s+ID/i)[0]
      .replace(ID_LINE, "").replace(ID_INLINE, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
    if (r && r !== expl) { set.explanation = r; stats.explClean++; }
  } else if (!expl.trim() && m?.rationale) {
    set.explanation = m.rationale; stats.explFill++;
  } else if (!expl.trim()) {
    stats.explMissing++; inc(c, "EXPLANATION_MISSING", "explanation", "flag", "", "", m?.sourcePdf);
  }

  // 5) limpieza rutinaria de stem y opciones (silenciosa); mojibake -> CSV
  let moji = false;
  const cs = cleanText(c.stem);
  if (cs.routine) { set.stem = cs.text; stats.routineStem++; } moji = moji || cs.mojibake;
  let optRoutine = false;
  const cleanedOpts = opts.map((o) => { const r = cleanText(o.text); if (r.routine) optRoutine = true; moji = moji || r.mojibake; return { ...o, text: r.text }; });
  if (optRoutine) { set.optionsJson = JSON.stringify(cleanedOpts); stats.routineOpt++; }
  if (moji) { stats.anomalies++; inc(c,"MOJIBAKE","text","flag",c.stem,"",m?.sourcePdf); }

  // 6) flags de contenido (no auto-fix)
  if (c.type === "MC") {
    if (opts.some((o) => !String(o.text ?? "").trim() && !o.imageUrl)) { stats.emptyOpt++; inc(c,"EMPTY_OPTION","optionsJson","flag",c.optionsJson,"",m?.sourcePdf); }
    const seen = new Set(); if (opts.some((o) => { const t = String(o.text ?? "").trim().toLowerCase(); if (t && seen.has(t)) return true; seen.add(t); return false; })) { stats.dupOpt++; inc(c,"DUPLICATE_OPTION","optionsJson","flag",c.optionsJson,"",m?.sourcePdf); }
  }
  const stemForFig = (set.stem ?? c.stem) || "";
  if (/\b(figure|graph|diagram|scatterplot|histogram|number line|coordinate plane|bar chart|bar graph)\b/i.test(stemForFig) && !withImage.has(c.id)) { stats.figNoImg++; inc(c,"FIGURE_NO_IMAGE","stem","flag",stemForFig,"",m?.sourcePdf); }

  if (Object.keys(set).length) updates.push({ id: c.id, set });
}

fs.writeFileSync(CSV, rows.join("\n"));

console.log(`=== ${APPLY ? "APPLY" : "DRY-RUN"} — Practice Sets ===`);
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(16)}: ${v}`);
console.log(`\nincidencias: ${rows.length - 1}  ->  ${CSV}`);
console.log(`candidatos con cambios propuestos: ${updates.length}`);

if (APPLY) {
  const tx = db.transaction((ups) => {
    for (const u of ups) {
      const cols = Object.keys(u.set); const sql = `UPDATE "IngestQuestionCandidate" SET ${cols.map((c)=>`"${c}"=@${c}`).join(", ")} WHERE id=@id`;
      db.prepare(sql).run({ ...u.set, id: u.id });
    }
  });
  tx(updates);
  console.log(`\nAPLICADO: ${updates.length} candidatos actualizados.`);
}
db.close();
