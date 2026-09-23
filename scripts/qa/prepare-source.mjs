// Prepare source files for side-by-side QA (read-only inputs).
// - DOCX -> PDF via soffice (cached)
// - PDF pages -> JPG via pdftoppm (cached)
// - per-page text via pdftotext -layout
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { abs, resolveSourceFilesForTest } from "./qa-common.mjs";

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28, ...opts });
}

// Convert docx->pdf if needed; return an absolute pdf path (cached in outDir).
export function ensurePdf(absSource, outDir) {
  if (!absSource || !fs.existsSync(absSource)) return null;
  if (/\.pdf$/i.test(absSource)) return absSource;
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(absSource).replace(/\.docx$/i, ".pdf");
  const outPdf = path.join(outDir, base);
  if (fs.existsSync(outPdf) && fs.statSync(outPdf).size > 0) return outPdf;
  sh("soffice", ["--headless", "--convert-to", "pdf", "--outdir", outDir, absSource]);
  return fs.existsSync(outPdf) ? outPdf : null;
}

// Render each page to JPG (cached). Returns array of absolute image paths (1-indexed pages).
export function renderPages(pdfPath, outDir, dpi = 150) {
  fs.mkdirSync(outDir, { recursive: true });
  const prefix = path.join(outDir, "page");
  const existing = fs.readdirSync(outDir).filter((f) => /^page-\d+\.jpg$/.test(f));
  if (existing.length === 0) {
    sh("pdftoppm", ["-jpeg", "-r", String(dpi), pdfPath, prefix]);
  }
  return fs
    .readdirSync(outDir)
    .filter((f) => /^page-\d+\.jpg$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
    .map((f) => path.join(outDir, f));
}

// Per-page text (form-feed separated).
export function pageTexts(pdfPath) {
  const out = sh("pdftotext", ["-layout", pdfPath, "-"]).toString("utf8");
  return out.split("\f").map((t) => t.trim());
}

// Prepare math + rw sources for a test into outDir/{math,rw}. Read-only source, writes only to scratch.
export function prepareTestSources(n, outDir) {
  const inv = resolveSourceFilesForTest(n);
  const result = { inv, math: null, rw: null };
  for (const [key, rel] of [["math", inv.mathQ], ["rw", inv.rwQ]]) {
    const src = abs(rel);
    if (!src) { result[key] = { error: "no source file" }; continue; }
    const dir = path.join(outDir, key);
    const pdf = ensurePdf(src, dir);
    if (!pdf) { result[key] = { error: "pdf conversion failed", src }; continue; }
    const images = renderPages(pdf, path.join(dir, "pages"));
    let texts = [];
    try { texts = pageTexts(pdf); } catch (e) { texts = []; }
    result[key] = { src, pdf, images, texts, pageCount: images.length };
  }
  return result;
}

// ---------- text-overlap matcher ----------
const STOP = new Set("the a an of to in on for and or is are was were be as by with at from that this which it its his her their our your you we they he she i".split(" "));
function toks(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\$[^$]*\$/g, " ") // drop math
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w));
}
// Score every page for a query; return {bestIndex(1-based), bestScore, scores[]}.
export function bestPageFor(queryText, texts) {
  const q = new Set(toks(queryText));
  if (q.size === 0 || !texts.length) return { bestIndex: null, bestScore: 0, scores: [] };
  const scores = texts.map((t) => {
    const p = new Set(toks(t));
    let inter = 0;
    for (const w of q) if (p.has(w)) inter++;
    return inter / q.size; // fraction of query tokens found on the page
  });
  let bestIndex = null, bestScore = 0;
  scores.forEach((s, i) => { if (s > bestScore) { bestScore = s; bestIndex = i + 1; } });
  return { bestIndex, bestScore, scores };
}
