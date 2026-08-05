#!/usr/bin/env node
/**
 * Pasada de vinculación de imágenes (DRY-RUN por defecto).
 * Contexto: las imágenes de páginas procesadas por pdfplumber se extrajeron como
 * IngestImageArtifact pero NUNCA se vincularon (el linker original solo enlaza por
 * refs markdown, que pdfplumber no genera). Aquí proponemos vínculos por
 * heurística de tamaño/posición y auto-aplicamos SOLO el caso de alta confianza:
 * candidato figura-referido con UNA sola imagen significativa en su página -> STEM.
 * Todo lo demás queda como propuesta marcada para revisión manual (UI image-links).
 * Con --apply inserta solo los AUTO. No toca Mock Exams.
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const CSV = path.join(ROOT, "scripts/ingest_patch/image_link_proposals.csv");
const MIN_W = 50, MIN_H = 30; // filtro de ruido (glyphs/decorativos)
const FIGURE_RE = /\b(figure|graph|diagram|shown|table|number line|coordinate plane|scatterplot|histogram|bar chart|bar graph|dot ?plot|boxplot)\b/i;

const db = new Database(path.join(ROOT, "dev.db"), { readonly: !APPLY });

const cands = db.prepare(
  `SELECT id, questionExternalId qid, pageArtifactId pa, type, stem, stimulus, optionsJson, correctAnswer
   FROM "IngestQuestionCandidate"
   WHERE contentType='PRACTICE_SET' AND pageArtifactId IS NOT NULL`
).all();

// imágenes significativas por página
const imgRows = db.prepare(
  `SELECT id, pageArtifactId pa, width, height, bboxJson FROM "IngestImageArtifact"
   WHERE pageArtifactId IS NOT NULL AND width >= ? AND height >= ?`
).all(MIN_W, MIN_H);
const imgsByPage = new Map();
for (const im of imgRows) {
  let top = 0, x0 = 0;
  try { const b = JSON.parse(im.bboxJson || "{}"); top = b.top ?? 0; x0 = b.x0 ?? 0; } catch {}
  const area = (im.width || 0) * (im.height || 0);
  (imgsByPage.get(im.pa) || imgsByPage.set(im.pa, []).get(im.pa)).push({ id: im.id, w: im.width, h: im.height, area, top, x0 });
}
// links existentes por candidato
const linked = new Map();
for (const l of db.prepare(`SELECT candidateId c, imageArtifactId i FROM "IngestCandidateImageLink"`).all()) {
  (linked.get(l.c) || linked.set(l.c, new Set()).get(l.c)).add(l.i);
}

const rows = [["candidateId","qid","case","targetType","optionLabel","imageArtifactId","imgWxH","nSignificant","confidence","action","stem"]];
const q = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ").slice(0, 200)}"`;
const inc = (c, kase, target, label, img, wxh, n, conf, action) =>
  rows.push([c.id, c.qid, kase, target, label ?? "", img ?? "", wxh ?? "", n, conf, action, (c.stem || "").slice(0, 120)].map(q).join(","));

const stats = { total: cands.length, autoStem: 0, flagStemMulti: 0, flagOptions: 0, flagOther: 0, applied: 0 };
const autoLinks = [];

for (const c of cands) {
  const all = imgsByPage.get(c.pa) || [];
  const already = linked.get(c.id) || new Set();
  const sig = all.filter((im) => !already.has(im.id)).sort((a, b) => b.area - a.area);
  if (!sig.length) continue;

  const refsFigure = FIGURE_RE.test(c.stem || "");
  let opts = []; try { opts = JSON.parse(c.optionsJson || "[]"); } catch {}
  const labels = opts.map((o) => String(o.label ?? "").toUpperCase());
  const answerBad = c.type === "MC" && (!c.correctAnswer || !labels.includes(String(c.correctAnswer).toUpperCase()) || labels.join("") !== "ABCD");
  const optionsEmpty = c.type === "MC" && opts.length >= 2 && opts.every((o) => !String(o.text ?? "").trim());

  if ((optionsEmpty || answerBad) && sig.length === 4) {
    // 4 imágenes -> probables opciones A-D por posición (top, luego x)
    const ordered = [...sig].sort((a, b) => a.top - b.top || a.x0 - b.x0);
    ordered.forEach((im, i) => inc(c, "IMAGE_OPTIONS", "OPTION", "ABCD"[i], im.id, `${im.w}x${im.h}`, sig.length, "MED", "flag"));
    stats.flagOptions++;
  } else if (refsFigure && sig.length === 1) {
    inc(c, "STEM_FIGURE", "STEM", "", sig[0].id, `${sig[0].w}x${sig[0].h}`, 1, "HIGH", "auto");
    autoLinks.push({ candidateId: c.id, imageArtifactId: sig[0].id, targetType: "STEM" });
    stats.autoStem++;
  } else if (refsFigure && sig.length > 1) {
    inc(c, "STEM_FIGURE_MULTI", "STEM", "", sig[0].id, `${sig[0].w}x${sig[0].h}`, sig.length, "LOW", "flag");
    stats.flagStemMulti++;
  } else {
    inc(c, "IMAGE_PRESENT_NO_REF", "STEM?", "", sig[0].id, `${sig[0].w}x${sig[0].h}`, sig.length, "LOW", "flag");
    stats.flagOther++;
  }
}

fs.writeFileSync(CSV, rows.join("\n"));
console.log(`=== ${APPLY ? "APPLY" : "DRY-RUN"} — image linking (Practice Sets) ===`);
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(16)}: ${v}`);
console.log(`\npropuestas: ${rows.length - 1}  ->  ${CSV}`);
console.log(`auto-links (alta confianza): ${autoLinks.length}`);

if (APPLY) {
  const now = new Date().toISOString();
  const ins = db.prepare(
    `INSERT OR IGNORE INTO "IngestCandidateImageLink" (id, batchId, candidateId, imageArtifactId, targetType, optionLabel, sortOrder, createdAt, updatedAt)
     SELECT 'imglink_' || lower(hex(randomblob(8))), (SELECT batchId FROM "IngestQuestionCandidate" WHERE id=@candidateId), @candidateId, @imageArtifactId, @targetType, NULL, 0, @now, @now`
  );
  const tx = db.transaction((ls) => { for (const l of ls) stats.applied += ins.run({ ...l, now }).changes; });
  tx(autoLinks);
  console.log(`\nAPLICADO: ${stats.applied} vínculos STEM de alta confianza.`);
}
db.close();
