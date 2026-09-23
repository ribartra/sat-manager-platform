// Read-only cross-stage recovery sweep for catalogued FPT content defects.
// For each defect (test + section + module + seq) it joins the 4 ingest stages
// (published Question -> candidate -> page artifact/OCR -> image artifacts) and
// emits the EARLIEST stage that still holds the correct content + an exact pointer,
// so we can tell what is recoverable WITHOUT re-OCR before assuming OCR is needed.
//
// NEVER writes to dev.db or official content. dev.db opened {readonly:true}.
// Usage: node scripts/qa/recover-sweep.mjs            (all catalogued defects)
//        node scripts/qa/recover-sweep.mjs "TEST 7"   (filter to one test)
import { openDb, resolveTestQuestions } from "./qa-common.mjs";

// ---- Catalogued recovery-priority defects (from docs/qa/test-*-findings.md) ----
// spec: [test, section, module(M1|M2), seq(1-based within module), class]
const DEFECTS = [
  // broken_question
  ["TEST 2", "RW",   "M2", 10, "broken_question"],
  ["TEST 2", "RW",   "M2", 27, "broken_question"],
  ["TEST 3", "MATH", "M1", 17, "broken_question"],
  ["TEST 4", "MATH", "M1", 19, "broken_question"],
  ["TEST 4", "RW",   "M1", 25, "broken_question"],
  ["TEST 6", "MATH", "M1", 8,  "broken_question"],
  ["TEST 6", "MATH", "M2", 12, "broken_question"],
  ["TEST 7", "RW",   "M2", 15, "broken_question"],
  ["TEST 7", "RW",   "M2", 19, "broken_question"],
  ["TEST 7", "RW",   "M2", 24, "broken_question"],
  ["TEST 10","MATH", "M1", 7,  "broken_question"],
  // image_missing / image_incomplete
  ["TEST 5", "MATH", "M1", 8,  "image_missing"],
  ["TEST 5", "MATH", "M1", 9,  "image_missing"],
  ["TEST 7", "MATH", "M1", 16, "image_missing"],
  ["TEST 7", "MATH", "M1", 17, "image_missing"],
  ["TEST 7", "MATH", "M1", 22, "image_missing"],
  ["TEST 7", "MATH", "M1", 18, "image_missing"],
  ["TEST 8", "MATH", "M1", 7,  "image_missing"],
  ["TEST 8", "MATH", "M1", 21, "image_missing"],
  ["TEST 8", "MATH", "M2", 4,  "image_missing"],
  ["TEST 8", "MATH", "M2", 20, "image_missing"],
  ["TEST 9", "MATH", "M1", 18, "image_missing"],
  ["TEST 9", "MATH", "M2", 14, "image_missing"],
  ["TEST 9", "MATH", "M2", 15, "image_missing"],
  ["TEST 10","MATH", "M1", 16, "image_missing"],
  ["TEST 10","MATH", "M1", 19, "image_incomplete"],
  // swap / option_text_wrong clusters (R&W M2)
  ["TEST 7", "RW",   "M2", 20, "swap"],
  ["TEST 7", "RW",   "M2", 21, "swap"],
  ["TEST 7", "RW",   "M2", 22, "swap"],
  ["TEST 7", "RW",   "M2", 23, "swap"],
  ["TEST 7", "RW",   "M2", 24, "swap"],
  ["TEST 9", "RW",   "M2", 20, "swap"],
  ["TEST 9", "RW",   "M2", 21, "swap"],
  ["TEST 9", "RW",   "M2", 23, "swap"],
  ["TEST 10","RW",   "M2", 20, "swap"],
  ["TEST 10","RW",   "M2", 21, "swap"],
  ["TEST 10","RW",   "M2", 22, "swap"],
  ["TEST 10","RW",   "M2", 23, "swap"],
  ["TEST 10","RW",   "M2", 24, "swap"],
  ["TEST 10","RW",   "M2", 25, "swap"],
];

const filterTest = process.argv[2] || null;
const db = openDb();

// prepared statements for the extra stages
const stCand = db.prepare(`SELECT id, pageArtifactId, sourceFileId, rawJson, warningsJson, answerSource,
  length(stem) stemLen, length(stimulus) stimLen, optionsJson, stem, stimulus FROM IngestQuestionCandidate WHERE officialQuestionId = ?`);
const stPage = db.prepare(`SELECT id, pageNumber, method, requiresOcr, status, length(extractedText) etLen, extractedText, layoutJson FROM IngestPageArtifact WHERE id = ?`);
const stLinks = db.prepare(`SELECT imageArtifactId, targetType, optionLabel, sortOrder FROM IngestCandidateImageLink WHERE candidateId = ? ORDER BY sortOrder`);
const stImgsOnPage = db.prepare(`SELECT id, imageIndex, imageId, origin, bboxJson, mimeType, width, height, length(base64Data) b64Len, fileUrl FROM IngestImageArtifact WHERE pageArtifactId = ? ORDER BY imageIndex`);
const stImg = db.prepare(`SELECT id, imageId, origin, bboxJson, width, height FROM IngestImageArtifact WHERE id = ?`);

function head(s, n = 90) { return (s == null ? "" : String(s)).replace(/\s+/g, " ").trim().slice(0, n); }
// map an ingest asset fileUrl -> on-disk path (bytes live in .private/uploads/ingest/<batch>/<file>)
function diskOf(fileUrl) { return fileUrl ? ".private/uploads/ingest/" + fileUrl.replace("/api/admin/ai-import/assets/", "") : null; }
function rawText(rawJson) { try { return JSON.parse(rawJson || "{}").text || ""; } catch { return ""; } }
function optsHeads(json) {
  try { return JSON.parse(json || "[]").map(o => `${o.label}:${head(o.text, 30)}${o.imageUrl ? "[img]" : ""}`); }
  catch { return []; }
}

// cache resolveTestQuestions per test
const testCache = new Map();
function getTest(t) { if (!testCache.has(t)) testCache.set(t, resolveTestQuestions(db, t)); return testCache.get(t); }

const summary = [];
for (const [test, section, mod, seq, cls] of DEFECTS) {
  if (filterTest && test !== filterTest) continue;
  const qs = getTest(test);
  const q = qs.find(x => x.section === section && x.moduleKey === mod && x.moduleSeq === seq);
  const label = `${test} ${section} ${mod}#${seq} [${cls}]`;
  console.log("\n" + "=".repeat(100) + "\n" + label);
  if (!q) { console.log("  !! question not found for spec"); summary.push([label, "NOT_FOUND", ""]); continue; }
  console.log(`  qid=${q.qid} type=${q.type}`);
  const pubStem = q.stem || "", pubStim = q.stimulus || "";
  const pubImgDisk = q.imageUrl ? "public/uploads/questions/" + q.imageUrl.split("/").pop() : null;
  console.log(`  [PUBLISHED] stemLen=${pubStem.length} stimLen=${pubStim.length} img=${q.imageUrl || "-"}${pubImgDisk ? " disk=" + pubImgDisk : ""}`);
  console.log(`     stem : ${head(pubStem)}`);
  if (pubStim) console.log(`     stim : ${head(pubStim)}`);
  console.log(`     opts : ${q.options.map(o => `${o.label}:${head(o.text, 26)}${o.imageUrl ? "[img]" : ""}`).join(" | ")}`);

  const c = stCand.get(q.qid);
  let verdict = "NEEDS_SOURCE_VISUAL", pointer = "";
  if (!c) { console.log("  [CANDIDATE] none linked"); summary.push([label, "NO_CANDIDATE", ""]); continue; }
  const cRaw = rawText(c.rawJson);
  console.log(`  [CANDIDATE] id=${c.id} candStemLen=${c.stemLen} candStimLen=${c.stimLen} rawTextLen=${cRaw.length} ansSrc=${c.answerSource}`);
  console.log(`     cStem: ${head(c.stem)}`);
  if (c.stimulus) console.log(`     cStim: ${head(c.stimulus)}`);
  console.log(`     cOpts: ${optsHeads(c.optionsJson).join(" | ")}`);
  if (cRaw) console.log(`     rawJson.text: ${head(cRaw, 140)}`);
  if (c.warningsJson) console.log(`     warnings: ${head(c.warningsJson, 120)}`);

  const p = c.pageArtifactId ? stPage.get(c.pageArtifactId) : null;
  if (p) {
    let imgCount = 0; try { imgCount = (JSON.parse(p.layoutJson || "{}").imageCount) || 0; } catch {}
    console.log(`  [PAGE] artifact=${p.id} page=${p.pageNumber} method=${p.method} requiresOcr=${p.requiresOcr} etLen=${p.etLen} layout.imageCount=${imgCount}`);
    console.log(`     extractedText: ${head(p.extractedText, 240)}`);
  } else {
    console.log("  [PAGE] none linked");
  }

  const links = stLinks.all(c.id);
  const pageImgs = c.pageArtifactId ? stImgsOnPage.all(c.pageArtifactId) : [];
  console.log(`  [IMAGES] candidate links=${links.length} | imageArtifacts on page=${pageImgs.length}`);
  for (const l of links) {
    const im = stImg.get(l.imageArtifactId);
    console.log(`     link ${l.targetType}${l.optionLabel ? "/" + l.optionLabel : ""} -> ${l.imageArtifactId} (${im ? im.imageId + " " + im.origin + " " + im.width + "x" + im.height + " bbox=" + head(im.bboxJson, 60) : "?"})`);
  }
  for (const im of pageImgs) {
    console.log(`     page-img [${im.imageIndex}] id=${im.id} ${im.imageId} ${im.origin} ${im.width}x${im.height} b64=${im.b64Len || 0} bbox=${head(im.bboxJson, 70)}`);
    if (im.fileUrl) console.log(`         disk=${diskOf(im.fileUrl)}`);
  }
  if (c) console.log(`  [CAND-ID] candidateId=${c.id}`);

  // ---- automatic verdict ----
  const isImageCase = cls === "image_missing" || cls === "image_incomplete";
  if (isImageCase) {
    // recoverable if the page has >1 image artifact (diagram exists but wrong one linked)
    const nonUiImgs = pageImgs.length;
    if (p && p.requiresOcr) { verdict = "NEEDS_REOCR"; }
    else if (nonUiImgs >= 1) { verdict = pageImgs.length > links.length || links.length === 0 ? "IMAGE_MISLINK" : "NEEDS_SOURCE_VISUAL"; pointer = `page=${p && p.pageNumber} imgArtifacts=[${pageImgs.map(i => i.imageId).join(",")}]`; }
    else { verdict = "NEEDS_SOURCE_VISUAL"; }
  } else {
    // text case: does the candidate hold much more than published? -> promotion drop
    const grewStem = c.stemLen > pubStem.length + 20;
    const candHasStim = (c.stimLen || 0) > (pubStim.length || 0) + 20;
    if (grewStem || candHasStim) { verdict = "PROMOTION_DROP"; pointer = `candidate=${c.id} field=${grewStem ? "stem" : "stimulus"}`; }
    else if (p && p.requiresOcr) { verdict = "NEEDS_REOCR"; }
    else if (p && p.etLen > 0) { verdict = "PARSE_MISALIGN"; pointer = `pageArtifact=${p.id} page=${p.pageNumber} etLen=${p.etLen}`; }
    else { verdict = "NEEDS_SOURCE_VISUAL"; }
  }
  console.log(`  >> VERDICT: ${verdict}  ${pointer}`);
  summary.push([label, verdict, pointer]);
}

console.log("\n" + "#".repeat(100) + "\nSUMMARY (" + summary.length + " defects)");
const byVerdict = {};
for (const [label, v, ptr] of summary) { (byVerdict[v] ||= []).push(label + (ptr ? "  ::  " + ptr : "")); }
for (const [v, arr] of Object.entries(byVerdict).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n[${v}] ${arr.length}`);
  for (const x of arr) console.log("   " + x);
}
db.close();
