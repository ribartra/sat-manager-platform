/**
 * Backfill: flag existing ingest candidates that still have embedded HTML/table
 * markup or unresolved markdown images in stem/stimulus/options, so Review and
 * Extracted Test views show needs-review / attention with clear English messages.
 *
 * Usage:
 *   node scripts/flag-ingest-stem-artifacts.mjs              # dry-run
 *   node scripts/flag-ingest-stem-artifacts.mjs --apply --confirm-server-stopped
 *
 * WAL SAFETY: --apply writes to dev.db with better-sqlite3. Stop web first:
 *   docker compose stop web
 */
import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const DB_PATH = path.resolve("dev.db");
const MD_IMAGE_RE = /!\[[^\]]*]\([^)]*\)/;
const MARKUP_RE = /<table\b|<\/?(?:html|body|div|td|tr|th|thead|tbody)\b|\[tbl-\d+\.html\]/i;

const MSG_MARKUP =
  "Embedded HTML or table in stem — replace with plain text or assign a STEM image, then clear the markup.";
const MSG_IMAGE =
  "Unresolved image in stem (markdown ![…] still present or image not linked) — assign STEM/OPTION image in review.";

const apply = process.argv.includes("--apply");
const confirmStopped = process.argv.includes("--confirm-server-stopped");

function textHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function parseWarnings(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

if (apply && !confirmStopped) {
  console.error(
    "\nRefusing to --apply without --confirm-server-stopped.\n" +
      "Stop the Next web process first (docker compose stop web), then re-run.\n",
  );
  process.exit(2);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`Missing ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 5000");

const candidates = db
  .prepare(
    `
  SELECT id, batchId, sourceFileId, pageArtifactId, status, promotionStatus,
         stem, stimulus, optionsJson, warningsJson, questionNumber, moduleLabel
  FROM IngestQuestionCandidate
  WHERE status != 'REJECTED'
`,
  )
  .all();

const hasStemLink = db.prepare(`
  SELECT 1 AS ok FROM IngestCandidateImageLink
  WHERE candidateId = ? AND targetType IN ('STEM', 'OPTION', 'OPTION_BLOCK', 'STIMULUS', 'ANSWER_FIELD')
  LIMIT 1
`);

const planned = [];
for (const c of candidates) {
  const blob = `${c.stem || ""}\n${c.stimulus || ""}\n${c.optionsJson || ""}`;
  const hasMarkup = MARKUP_RE.test(blob);
  const hasMd = MD_IMAGE_RE.test(blob);
  const linked = !!hasStemLink.get(c.id);
  const imageGap = hasMd && !linked;
  const leftoverMd = hasMd; // leftover markdown image in text always needs attention
  if (!hasMarkup && !leftoverMd && !imageGap) continue;

  const reasons = [];
  if (hasMarkup) reasons.push("markup");
  if (leftoverMd || imageGap) reasons.push("image");

  const warnings = parseWarnings(c.warningsJson);
  const toAdd = [];
  if (hasMarkup && !warnings.some((w) => w.includes("Embedded HTML or table"))) toAdd.push(MSG_MARKUP);
  if ((leftoverMd || imageGap) && !warnings.some((w) => w.includes("Unresolved image"))) toAdd.push(MSG_IMAGE);

  const needsStatus = c.status !== "NEEDS_REVIEW";
  const needsWarnings = toAdd.length > 0;
  if (!needsStatus && !needsWarnings) continue;

  planned.push({
    id: c.id,
    batchId: c.batchId,
    sourceFileId: c.sourceFileId,
    pageArtifactId: c.pageArtifactId,
    status: c.status,
    promotionStatus: c.promotionStatus,
    label: [c.moduleLabel, c.questionNumber != null ? `Q${c.questionNumber}` : c.id.slice(0, 12)].filter(Boolean).join(" · "),
    reasons,
    toAdd,
    needsStatus,
    nextWarnings: [...warnings, ...toAdd],
  });
}

console.log(`Scanned ${candidates.length} candidates; ${planned.length} need flagging.`);
const byReason = { markup: 0, image: 0, both: 0 };
for (const p of planned) {
  if (p.reasons.includes("markup") && p.reasons.includes("image")) byReason.both += 1;
  else if (p.reasons.includes("markup")) byReason.markup += 1;
  else byReason.image += 1;
}
console.log("Breakdown:", byReason);
console.log(
  "By current status:",
  planned.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {}),
);

for (const p of planned.slice(0, 15)) {
  console.log(`  - ${p.label} [${p.status}/${p.promotionStatus}] ${p.reasons.join("+")}`);
}
if (planned.length > 15) console.log(`  … and ${planned.length - 15} more`);

if (!apply) {
  console.log("\nDry-run only. Re-run with --apply --confirm-server-stopped to write.");
  db.close();
  process.exit(0);
}

const updateCand = db.prepare(`
  UPDATE IngestQuestionCandidate
  SET status = 'NEEDS_REVIEW', warningsJson = ?, updatedAt = datetime('now')
  WHERE id = ?
`);
const insertIncident = db.prepare(`
  INSERT OR IGNORE INTO IngestIncident
    (id, batchId, sourceFileId, pageArtifactId, severity, code, message, decision, action, status, contextHash)
  VALUES (@id, @batchId, @sourceFileId, @pageArtifactId, @severity, @code, @message, @decision, @action, 'OPEN', @contextHash)
`);

const tx = db.transaction(() => {
  let updated = 0;
  let incidents = 0;
  for (const p of planned) {
    updateCand.run(JSON.stringify(p.nextWarnings), p.id);
    updated += 1;
    if (p.reasons.includes("markup")) {
      const message = `Candidate ${p.id} contains embedded HTML or a table asset in stem/options text.`;
      const contextHash = textHash([p.batchId, p.sourceFileId || "", p.pageArtifactId || "", "WARNING", "STEM_EMBEDDED_HTML_OR_TABLE", message].join("|"));
      const info = insertIncident.run({
        id: newId("inc"),
        batchId: p.batchId,
        sourceFileId: p.sourceFileId,
        pageArtifactId: p.pageArtifactId,
        severity: "WARNING",
        code: "STEM_EMBEDDED_HTML_OR_TABLE",
        message,
        decision: "OCR left HTML/table markup in the question body; students cannot use this as plain text.",
        action: "Replace with transcribed text or assign a STEM image, then clear the markup.",
        contextHash,
      });
      incidents += info.changes;
    }
    if (p.reasons.includes("image")) {
      const message = `Candidate ${p.id} still has unresolved image refs in stem/stimulus.`;
      const contextHash = textHash([p.batchId, p.sourceFileId || "", p.pageArtifactId || "", "WARNING", "CANDIDATE_IMAGE_LINK_INCOMPLETE", message].join("|"));
      const info = insertIncident.run({
        id: newId("inc"),
        batchId: p.batchId,
        sourceFileId: p.sourceFileId,
        pageArtifactId: p.pageArtifactId,
        severity: "WARNING",
        code: "CANDIDATE_IMAGE_LINK_INCOMPLETE",
        message,
        decision: "Markdown image refs remain or no STEM/OPTION image link was saved.",
        action: "Assign the correct page/crop image in the review wizard before relying on this question.",
        contextHash,
      });
      incidents += info.changes;
    }
  }
  return { updated, incidents };
});

const result = tx();
console.log(`Applied: updated ${result.updated} candidates; inserted ${result.incidents} incidents.`);
console.log("wal_checkpoint:", JSON.stringify(db.pragma("wal_checkpoint(TRUNCATE)")));
console.log("integrity_check:", JSON.stringify(db.pragma("integrity_check")));
db.close();
