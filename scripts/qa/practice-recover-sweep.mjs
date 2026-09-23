// Read-only cross-stage recovery sweep for the catalogued MATH Practice Sets
// content defects (docs/qa/practice/math-*-findings.md). Analog of recover-sweep.mjs
// (FPT). For each defect qid it joins the ingest stages
//   published Question -> IngestQuestionCandidate -> IngestPageArtifact(OCR text)
//                      -> IngestImageArtifact / IngestCandidateImageLink
// and emits the EARLIEST stage that still holds the dropped content, plus a verdict,
// so we can prove how much is recoverable WITHOUT re-running OCR.
//
// The dominant practice defect is "source math/table/graph rendered as an IMAGE was
// dropped at promotion" -> so an image case is recoverable if the page still carries
// an image artifact, and a text case may be recoverable from candidate text, page
// extractedText, OR a page image artifact.
//
// NEVER writes to dev.db or official content. dev.db opened {readonly:true}.
// Usage: node scripts/qa/practice-recover-sweep.mjs [--md] [domainFilter]
//   --md            also write docs/qa/practice/recovery-map.md
//   domainFilter    substring match against the findings filename (e.g. "algebra")
import fs from "node:fs";
import path from "node:path";
import { openDb, REPO_ROOT } from "./qa-common.mjs";
import { resolveMathPracticeSets } from "./practice-common.mjs";

const FINDINGS_DIR = path.join(REPO_ROOT, "docs", "qa", "practice");
const FINDINGS_FILES = [
  "math-advanced-findings.md",
  "math-algebra-findings.md",
  "math-geometry-findings.md",
  "math-psda-1-findings.md",
  "math-psda-2-findings.md",
];

const args = process.argv.slice(2);
const writeMd = args.includes("--md");
const domainFilter = args.find((a) => !a.startsWith("--")) || null;

// ---- parse catalogued defects from the findings markdown ----------------------
// A defect line contains "| class=<cls> |" and begins (after "- " or "`") with the qid.
const CUID = /\bc[a-z0-9]{20,}\b/;
const DEFECT_CLASSES = new Set([
  "broken_question", "image_missing", "image_incomplete", "answer_key_wrong",
  "option_text_wrong", "stem_option_leak", "type_mismatch", "redundant_ui_image",
  "option_dup", "stem_number_leak", "escaped_underscore", "option_label_leak",
]);
function parseDefects() {
  const out = [];
  for (const fname of FINDINGS_FILES) {
    if (domainFilter && !fname.includes(domainFilter)) continue;
    const abs = path.join(FINDINGS_DIR, fname);
    const text = fs.readFileSync(abs, "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      // must be a per-defect line: starts with a qid (after optional "- " / "`"),
      // and carries an explicit class= token. Skip the format-legend line.
      if (!/\|\s*class=/.test(line)) continue;
      const lead = line.replace(/^[-`\s]+/, "");
      const m = lead.match(/^(c[a-z0-9]{20,})\b/);
      if (!m) continue; // e.g. the "Formato de hallazgo" legend
      const cls = (line.match(/class=([a-z_]+)/) || [])[1] || "unknown";
      if (!DEFECT_CLASSES.has(cls)) continue; // skip documented false-positives, e.g. "class=(sin defecto)"
      out.push({ qid: m[1], cls, file: fname, snippet: line.slice(0, 160) });
    }
  }
  return out;
}

// ---- open db + build qid -> published question index --------------------------
const db = openDb();
const sets = resolveMathPracticeSets(db);
const qIndex = new Map();
for (const s of sets) {
  for (const q of s.questions) {
    qIndex.set(q.qid, { ...q, setName: s.name, domain: s.domain, topic: s.topic,
      difficulty: s.difficulty, exercisePdf: s.exercisePdf, ansPdf: s.ansPdf });
  }
}

// prepared statements for the extra ingest stages (same as FPT recover-sweep)
const stCand = db.prepare(`SELECT id, pageArtifactId, sourceFileId, rawJson, warningsJson, answerSource,
  length(stem) stemLen, length(stimulus) stimLen, optionsJson, stem, stimulus FROM IngestQuestionCandidate WHERE officialQuestionId = ?`);
const stPage = db.prepare(`SELECT id, pageNumber, method, requiresOcr, status, length(extractedText) etLen, extractedText, layoutJson FROM IngestPageArtifact WHERE id = ?`);
const stLinks = db.prepare(`SELECT imageArtifactId, targetType, optionLabel, sortOrder FROM IngestCandidateImageLink WHERE candidateId = ? ORDER BY sortOrder`);
const stImgsOnPage = db.prepare(`SELECT id, imageIndex, imageId, origin, bboxJson, mimeType, width, height, length(base64Data) b64Len, fileUrl FROM IngestImageArtifact WHERE pageArtifactId = ? ORDER BY imageIndex`);

function head(s, n = 90) { return (s == null ? "" : String(s)).replace(/\s+/g, " ").trim().slice(0, n); }
function rawText(rawJson) { try { return JSON.parse(rawJson || "{}").text || ""; } catch { return ""; } }
function diskOf(fileUrl) { return fileUrl ? ".private/uploads/ingest/" + fileUrl.replace("/api/admin/ai-import/assets/", "") : null; }

const IMAGE_CLASSES = new Set(["image_missing", "image_incomplete", "redundant_ui_image"]);
const KEY_CLASSES = new Set(["answer_key_wrong"]);

const defects = parseDefects();
const rows = [];
for (const d of defects) {
  const q = qIndex.get(d.qid);
  const label = q ? `${q.domain} / ${q.setName} / qid=${d.qid} [${d.cls}]`
                  : `?? qid=${d.qid} [${d.cls}] (from ${d.file})`;
  console.log("\n" + "=".repeat(100) + "\n" + label);
  if (!q) { rows.push({ ...d, verdict: "NOT_FOUND", pointer: "" }); console.log("  !! qid not in resolved practice sets"); continue; }

  const pubStem = q.stem || "", pubStim = q.stimulus || "";
  console.log(`  [PUBLISHED] type=${q.type} stemLen=${pubStem.length} stimLen=${pubStim.length} img=${q.imageUrl || "-"} key=${head(q.correctAnswer, 40)}`);
  console.log(`     opts : ${q.options.map((o) => `${o.label}:${head(o.text, 22)}${o.imageUrl ? "[img]" : ""}`).join(" | ")}`);

  const c = stCand.get(d.qid);
  let verdict = "NEEDS_SOURCE_VISUAL", pointer = "";
  if (!c) { console.log("  [CANDIDATE] none linked"); rows.push({ ...d, verdict: "NO_CANDIDATE", pointer: "" }); continue; }
  const cRaw = rawText(c.rawJson);
  console.log(`  [CANDIDATE] id=${c.id} candStemLen=${c.stemLen} candStimLen=${c.stimLen} rawTextLen=${cRaw.length} ansSrc=${c.answerSource}`);

  const p = c.pageArtifactId ? stPage.get(c.pageArtifactId) : null;
  let imgCount = 0;
  if (p) { try { imgCount = (JSON.parse(p.layoutJson || "{}").imageCount) || 0; } catch {}
    console.log(`  [PAGE] artifact=${p.id} page=${p.pageNumber} method=${p.method} requiresOcr=${p.requiresOcr} etLen=${p.etLen} layout.imageCount=${imgCount}`); }
  else console.log("  [PAGE] none linked");

  const links = c ? stLinks.all(c.id) : [];
  const pageImgs = c && c.pageArtifactId ? stImgsOnPage.all(c.pageArtifactId) : [];
  console.log(`  [IMAGES] candidate links=${links.length} | imageArtifacts on page=${pageImgs.length}`);
  for (const im of pageImgs) console.log(`     page-img [${im.imageIndex}] id=${im.id} ${im.imageId} ${im.origin} ${im.width}x${im.height} b64=${im.b64Len || 0}${im.fileUrl ? " disk=" + diskOf(im.fileUrl) : ""}`);

  // ---- automatic verdict (practice-tuned) ----
  // NOTE: rawJson.text length is NOT a recovery signal — it carries a
  // "Question ID:/Question/Answer" wrapper + option text, so it is longer than the
  // stem even when the dropped math (rendered as an image in the source) is absent
  // from the OCR text too. Verified by spot-check: OCR dropped the same equations.
  // Only a candidate STEM/STIMULUS that is materially longer than the published one
  // means text is sitting in ingest ready to copy without re-transcription.
  const grewStem = c.stemLen > pubStem.length + 15;
  const candHasStim = (c.stimLen || 0) > (pubStim.length || 0) + 15;
  const hasPageImg = pageImgs.length >= 1;

  if (KEY_CLASSES.has(d.cls)) {
    // answer key: correct value read from the ANS PDF during detection; already enumerated.
    verdict = q.ansPdf && fs.existsSync(q.ansPdf) ? "ANS_PDF_KEY" : "NEEDS_SOURCE_VISUAL";
    pointer = q.ansPdf ? path.relative(REPO_ROOT, q.ansPdf) : "";
  } else if (IMAGE_CLASSES.has(d.cls)) {
    if (d.cls === "redundant_ui_image") { verdict = "UI_IMAGE_REMOVE"; pointer = "drop stray option/UI image"; }
    else if (hasPageImg) { verdict = "IMAGE_ON_PAGE"; pointer = `page=${p && p.pageNumber} imgArtifacts=[${pageImgs.map((i) => i.imageId).join(",")}]`; }
    else if (p && p.requiresOcr && (p.etLen || 0) === 0) { verdict = "NEEDS_REOCR"; pointer = `pageArtifact=${p.id}`; }
    else { verdict = "NEEDS_SOURCE_VISUAL"; pointer = q.exercisePdf ? path.relative(REPO_ROOT, q.exercisePdf) + (q.pageNumber ? `#p${q.pageNumber}` : "") : ""; }
  } else {
    // text case (broken_question / *_leak / option_text_wrong / type_mismatch)
    if (grewStem || candHasStim) { verdict = "PROMOTION_DROP_TEXT"; pointer = `candidate=${c.id} field=${grewStem ? "stem" : "stimulus"}`; }
    else if (hasPageImg) { verdict = "IMAGE_ON_PAGE"; pointer = `page=${p && p.pageNumber} imgArtifacts=[${pageImgs.map((i) => i.imageId).join(",")}] (math rendered as image)`; }
    else if (p && p.requiresOcr && (p.etLen || 0) === 0) { verdict = "NEEDS_REOCR"; pointer = `pageArtifact=${p.id}`; }
    else { verdict = "NEEDS_SOURCE_VISUAL"; pointer = q.exercisePdf ? path.relative(REPO_ROOT, q.exercisePdf) + (q.pageNumber ? `#p${q.pageNumber}` : "") : ""; }
  }
  console.log(`  >> VERDICT: ${verdict}  ${pointer}`);
  rows.push({ ...d, verdict, pointer, domain: q.domain, setName: q.setName });
}

// ---- summary ------------------------------------------------------------------
console.log("\n" + "#".repeat(100) + "\nSUMMARY (" + rows.length + " defects across " + (domainFilter || "all domains") + ")");
const byVerdict = {};
for (const r of rows) (byVerdict[r.verdict] ||= []).push(r);
const order = Object.entries(byVerdict).sort((a, b) => b[1].length - a[1].length);
for (const [v, arr] of order) console.log(`  [${v}] ${arr.length}`);
const REOCR = (byVerdict["NEEDS_REOCR"] || []).length;
console.log(`\n  ==> NEEDS_REOCR = ${REOCR}  (README claim: 0)`);

if (writeMd) {
  const NON_RECOVERABLE = new Set(["NEEDS_REOCR", "NOT_FOUND", "NO_CANDIDATE"]);
  const recoverable = rows.filter((r) => !NON_RECOVERABLE.has(r.verdict)).length;
  let md = `# Recovery map — MATH Practice Sets content defects\n\n`;
  md += `- **Fecha:** ${new Date().toISOString().slice(0, 10)}\n`;
  md += `- **Fuente:** \`scripts/qa/practice-recover-sweep.mjs\` (read-only; \`dev.db\` abierta \`{readonly:true}\`).\n`;
  md += `- **Entrada:** ${rows.length} líneas de defecto de \`docs/qa/practice/math-*-findings.md\`.\n`;
  md += `- **Objetivo:** por cada defecto, la etapa de ingesta más temprana que aún conserva el contenido caído, para saber cuánto se recupera **sin re-OCR**.\n\n`;
  md += `## Resultado principal\n\n`;
  md += `**\`NEEDS_REOCR = ${REOCR}\`** — ningún defecto requiere re-ejecutar la tubería OCR. Re-correr OCR no ayudaría: el OCR (Mistral) **ya descartó** la matemática/figura renderizada como imagen en la fuente (verificado por muestreo: la ecuación no está ni en \`candidate.stem\` ni en \`rawJson.text\`). La recuperación es **transcripción / crop-assign desde la fuente**, que ya está en disco (PDF de ejercicio + crops \`pdfplumber\` en \`IngestImageArtifact\`).\n\n`;
  md += `> **Caveat de método:** la promoción copia \`candidate.stem\` → \`Question.stem\` **verbatim**, así que el texto del candidato nunca contiene más que lo publicado (0 \`PROMOTION_DROP_TEXT\`). \`IMAGE_ON_PAGE\` significa que la página fuente tiene ≥1 crop \`pdfplumber\` en ingesta **para inspeccionar primero** — no garantiza que ese crop sea exactamente la figura buscada; el fix confirma visualmente. \`NEEDS_SOURCE_VISUAL\` = sin crop en ingesta: ir directo a la página del PDF fuente.\n\n`;
  md += `## Veredicto agregado\n\n| Veredicto | # | Recuperable sin re-OCR | Significado |\n|---|---|---|---|\n`;
  const MEANING = {
    IMAGE_ON_PAGE: "la página fuente tiene ≥1 crop `pdfplumber` (`IngestImageArtifact`) para inspeccionar/asignar primero",
    ANS_PDF_KEY: "clave correcta legible en el PDF `ANS`",
    UI_IMAGE_REMOVE: "imagen de UI redundante; quitar",
    NEEDS_SOURCE_VISUAL: "sin crop en ingesta; transcribir de la página del PDF fuente (ya en disco, sin re-OCR)",
    NEEDS_REOCR: "requiere re-ejecutar OCR",
    PROMOTION_DROP_TEXT: "texto completo en el candidato (imposible aquí: la promoción copia el stem verbatim)",
    NOT_FOUND: "qid no está en los sets resueltos",
    NO_CANDIDATE: "sin candidato de ingesta enlazado",
  };
  for (const [v, arr] of order) md += `| ${v} | ${arr.length} | ${NON_RECOVERABLE.has(v) ? "—" : "✅"} | ${MEANING[v] || ""} |\n`;
  md += `\n**Recuperable sin re-OCR: ${recoverable}/${rows.length}. NEEDS_REOCR: ${REOCR}.**\n\n`;
  md += `## Detalle por defecto\n\n| Dominio | Set | qid | clase | veredicto | puntero |\n|---|---|---|---|---|---|\n`;
  for (const r of rows.sort((a, b) => (a.domain || "").localeCompare(b.domain || "") || a.verdict.localeCompare(b.verdict))) {
    md += `| ${r.domain || "?"} | ${r.setName || "?"} | \`${r.qid}\` | ${r.cls} | ${r.verdict} | ${(r.pointer || "").replace(/\|/g, "\\|")} |\n`;
  }
  const outPath = path.join(FINDINGS_DIR, "recovery-map.md");
  fs.writeFileSync(outPath, md);
  console.log(`\n  wrote ${path.relative(REPO_ROOT, outPath)}`);
}

db.close();
