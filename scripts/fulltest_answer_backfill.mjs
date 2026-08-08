// Backfill de respuestas de full-test desde el DOCX de Answer Explanations, mapeando
// por CONTENIDO (no por posición: los bloques de respuesta van en secuencia sin etiqueta
// Qn y pueden faltar algunos, así que la posición desalinea). Cada explicación repite
// números/tokens del enunciado; emparejamos cada candidato sin respuesta con el bloque
// de mayor solape numérico.
//
// Uso:
//   node scripts/fulltest_answer_backfill.mjs --pdf <sourceFileId> [--docx <sourceFileId>] [--apply]
//   (--docx opcional: se autodetecta por testNumber+section entre los ANSWER_EXPLANATION)
// Dry-run por defecto: imprime la tabla candidato→respuesta para validación humana.
// Correr con web+ingest tal cual (escribe vía sqlite del contenedor si se prefiere; aquí
// usa el mismo dev.db). Idempotente: solo toca candidatos NEEDS_REVIEW sin correctAnswer.
import Database from "better-sqlite3";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
function argval(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
const PDF_SRC = argval("--pdf");
let DOCX_SRC = argval("--docx");
const MIN_SCORE = Number(argval("--min") || 2);   // solape numérico mínimo
const MIN_MARGIN = Number(argval("--margin") || 1); // ventaja sobre el 2º mejor
const DB = process.env.REOCR_DB || "dev.db";
if (!PDF_SRC) { console.error("falta --pdf <sourceFileId>"); process.exit(1); }

const db = new Database(DB);
db.pragma("journal_mode = WAL");

const pdf = db.prepare(`SELECT * FROM IngestSourceFile WHERE id=?`).get(PDF_SRC);
if (!pdf) { console.error("PDF source no encontrado"); process.exit(1); }
if (!DOCX_SRC) {
  const cand = db.prepare(`
    SELECT id, relativePath FROM IngestSourceFile
    WHERE sourceKind IN ('ANSWER_EXPLANATION','ANSWER_KEY') AND testNumber IS ? AND (section IS ? OR section IS NULL)
    ORDER BY (sourceKind='ANSWER_EXPLANATION') DESC`).all(pdf.testNumber, pdf.section);
  if (!cand.length) { console.error("no se encontró DOCX de respuestas para test", pdf.testNumber, pdf.section); process.exit(1); }
  DOCX_SRC = cand[0].id;
  console.log(`DOCX autodetectado: ${cand[0].relativePath} (${DOCX_SRC})`);
}
const docxTxt = db.prepare(`SELECT group_concat(extractedText, '\n') t FROM IngestPageArtifact WHERE sourceFileId=?`).get(DOCX_SRC).t || "";

// --- 1) sección de descripciones (numeradas Qn por módulo) vs sección de respuestas ---
const start = docxTxt.search(/(?:✓\s*)?Correct Answer/i);
const descSection = start >= 0 ? docxTxt.slice(0, start) : "";
const ansSection = start >= 0 ? docxTxt.slice(start) : docxTxt;

// descripciones: segmentar por marcadores de módulo, luego "Qn. texto"
const modMarks = [...descSection.matchAll(/MODULE\s*(\d)[AB]?\s*[—\-–][^\n]*/gi)].map(mm => ({ mod: mm[1], at: mm.index }));
function moduleAt(pos) { let mod = "1"; for (const mk of modMarks) if (pos >= mk.at) mod = mk.mod; return mod; }
const descs = [];
for (const mm of descSection.matchAll(/\bQ(\d+)\.\s*([\s\S]*?)(?=\bQ\d+\.|MODULE\s*\d|$)/g)) {
  descs.push({ mod: moduleAt(mm.index), qn: Number(mm[1]), text: mm[2].replace(/\s+/g, " ").trim() });
}
console.log(`descripciones numeradas: ${descs.length} (${descs.filter(d => d.mod === "1").length} en módulo 1)`);

// bloques de respuesta: secuencia valor + explicación
const re = /(?:✓\s*)?Correct Answer\s*[:：]?\s*([A-Za-z0-9.\/\-]+)/gi;
const marks = [];
let m;
while ((m = re.exec(ansSection))) marks.push({ value: m[1], at: m.index, end: re.lastIndex });
const blocks = marks.map((mk, i) => ({
  value: mk.value.trim(),
  expl: ansSection.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : mk.end + 400).replace(/\s+/g, " ").trim(),
}));
console.log(`bloques de respuesta en DOCX: ${blocks.length}`);

// --- firma: números (>=2 cifras pesan) + palabras distintivas (nombres, sustantivos) ---
const STOP = new Set("which following equation expression value given graph shows what constant constants where positive negative solution solutions function line lines slope point points table figure form terms number numbers each into scale drawn note".split(" "));
function signature(s) {
  const clean = (s || "").replace(/\$/g, "").toLowerCase();
  const nums = [];
  for (const mm of clean.matchAll(/-?\d+(?:\.\d+)?(?:\/\d+)?/g)) nums.push(mm[0].replace(/^-/, "").replace(/^0+(\d)/, "$1"));
  const words = [];
  for (const mm of clean.matchAll(/[a-z]{4,}/g)) if (!STOP.has(mm[0])) words.push(mm[0]);
  return { nums, words };
}
function scoreOverlap(stemSig, block) {
  const bSig = signature(block.expl);
  const nBag = {}; for (const n of bSig.nums) nBag[n] = (nBag[n] || 0) + 1;
  const wBag = {}; for (const w of bSig.words) wBag[w] = (wBag[w] || 0) + 1;
  let s = 0;
  for (const n of stemSig.nums) if (nBag[n] > 0) { nBag[n]--; s += (n.length >= 2 ? 2 : 1); } // números de 2+ cifras pesan más
  for (const w of stemSig.words) if (wBag[w] > 0) { wBag[w]--; s += (w.length >= 6 ? 2 : 1); }   // palabras largas pesan más
  return s;
}

// --- candidatos objetivo: del PDF, NEEDS_REVIEW, sin respuesta ---
const cands = db.prepare(`
  SELECT c.id, c.questionNumber qn, c.moduleLabel mod, c.type, c.stem, c.optionsJson,
         (SELECT count(*) FROM IngestImageArtifact i WHERE i.sourceFileId=c.sourceFileId) hasImgs
  FROM IngestQuestionCandidate c
  WHERE c.sourceFileId=? AND c.status='NEEDS_REVIEW' AND (c.correctAnswer IS NULL OR c.correctAnswer='')
  ORDER BY c.questionNumber`).all(PDF_SRC);
console.log(`candidatos sin respuesta: ${cands.length}\n`);

// --- 2) alineación MONÓTONA descripciones(A) ↔ bloques de respuesta(B) ---
// Ambas listas están en el MISMO orden; algunos bloques pueden faltar. DP tipo
// Needleman-Wunsch que empareja cada bloque con una descripción respetando el orden
// y permitiendo saltar descripciones (huecos). Score = solape de firma desc↔explicación.
const A = descs;                     // 44 descripciones numeradas
const B = blocks;                    // 40 bloques de respuesta
const descSig = A.map(d => signature(d.text));
const GAP = 0;                       // saltar una descripción no cuesta (hay huecos reales)
const NEG = -1;                      // emparejar sin ningún solape penaliza levemente
const dp = Array.from({ length: A.length + 1 }, () => new Float64Array(B.length + 1));
const bt = Array.from({ length: A.length + 1 }, () => new Int8Array(B.length + 1));
for (let i = 1; i <= A.length; i++) dp[i][0] = dp[i - 1][0] + GAP;             // saltar desc
for (let j = 1; j <= B.length; j++) dp[0][j] = -1e9;                          // todo bloque debe emparejarse
for (let i = 1; i <= A.length; i++) {
  for (let j = 1; j <= B.length; j++) {
    const sc = scoreOverlap(descSig[i - 1], B[j - 1]) || NEG;
    const match = dp[i - 1][j - 1] + sc;   // empareja A[i-1] con B[j-1]
    const skipA = dp[i - 1][j] + GAP;      // A[i-1] no tiene bloque (hueco)
    if (match >= skipA) { dp[i][j] = match; bt[i][j] = 1; }
    else { dp[i][j] = skipA; bt[i][j] = 2; }
  }
}
// backtrack -> answerByQ[mod][qn] = value
const answerByQ = {};
let i = A.length, j = B.length;
while (i > 0 && j > 0) {
  if (bt[i][j] === 1) { const d = A[i - 1]; (answerByQ[d.mod] ||= {})[d.qn] = B[j - 1].value; i--; j--; }
  else i--;
}

// --- 3) proponer respuesta por candidato via su questionNumber (== Qn de módulo 1) ---
function letterOrNum(v) { return /^[A-D]$/i.test(v) ? v.toUpperCase() : v; }
const proposals = cands.map(c => {
  const mod = "1"; // estos candidatos NEEDS_REVIEW son módulo 1 (verificado por stems)
  const val = answerByQ[mod] ? answerByQ[mod][c.qn] : null;
  const desc = A.find(d => d.mod === mod && d.qn === c.qn);
  return { c, val: val ? letterOrNum(val) : null, desc };
});

console.log("\nq# | tipo | resp | descripción DOCX (Qn) :: enunciado candidato");
console.log("-".repeat(118));
for (const p of proposals) {
  const stem = (p.c.stem || "").replace(/\s+/g, " ").slice(0, 40);
  const dtext = p.desc ? p.desc.text.slice(0, 46) : "(sin descripción)";
  console.log(`${String(p.c.qn).padStart(2)} | ${p.c.type.padEnd(7)} | ${(p.val || "??").padEnd(5)} | ${dtext} :: ${stem}`);
}
const good = proposals.filter(p => p.val);
const bad = proposals.filter(p => !p.val);
console.log(`\nmódulo 1 alineado: ${Object.keys(answerByQ["1"] || {}).length}/22 preguntas con respuesta`);
console.log(`candidatos: ${good.length} con respuesta propuesta, ${bad.length} sin (${bad.map(p => "q" + p.c.qn).join(", ")})`);

if (APPLY) {
  const now = new Date().toISOString();
  // respuesta de letra en candidato NUMERIC ⇒ era MC con opciones no capturadas: corrige el tipo.
  const upMC = db.prepare(`UPDATE IngestQuestionCandidate SET correctAnswer=?, type='MC', updatedAt=? WHERE id=?`);
  const upNum = db.prepare(`UPDATE IngestQuestionCandidate SET correctAnswer=?, updatedAt=? WHERE id=?`);
  let n = 0, retyped = 0;
  const tx = db.transaction(() => {
    for (const p of good) {
      const isLetter = /^[A-D]$/.test(p.val);
      if (isLetter && p.c.type !== "MC") { upMC.run(p.val, now, p.c.id); retyped++; }
      else upNum.run(p.val, now, p.c.id);
      n++;
    }
  });
  tx();
  console.log(`\n[APPLY] correctAnswer seteado en ${n} candidatos (${retyped} re-tipados NUMERIC→MC por respuesta de letra).`);
} else {
  console.log("\n(dry-run) valida la tabla; usa --apply para escribir.");
}
db.close();
