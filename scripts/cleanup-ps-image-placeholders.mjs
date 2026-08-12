/**
 * Careful Practice Set cleanup: strip OCR image/table placeholders ONLY when a
 * STEM image is already assigned (link or official imageUrl), and clear obsolete
 * warnings. Does NOT touch questions that still need an image.
 *
 * Usage:
 *   node scripts/cleanup-ps-image-placeholders.mjs              # dry-run
 *   node scripts/cleanup-ps-image-placeholders.mjs --apply --confirm-server-stopped
 *
 * WAL SAFETY: --apply writes to dev.db with better-sqlite3. Stop web first:
 *   docker compose stop web
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.resolve("dev.db");
const apply = process.argv.includes("--apply");
const confirmStopped = process.argv.includes("--confirm-server-stopped");

const MD_IMAGE_RE = /!\[[^\]]*]\([^)]*\)/g;
const TBL_ASSET_RE = /\[tbl-\d+\.html\](?:\([^)]*\))?/gi;
const BLANK_TBL_BLEED_RE = /(_____)(\s*\[tbl-\d+\.html\](?:\([^)]*\))?[\s\S]*)$/i;
const ORPHAN_TRAILING_TBL_RE = /([.?!])\s*\[tbl-\d+\.html\](?:\([^)]*\))?\s*$/i;
const FIGURE_BRACKET_PLACEHOLDER_RE =
  /\[[^\]]*(?:graph|figure|chart|histogram|scatter(?:\s*plot)?|table)[^\]]*\]/gi;

const OBSOLETE_IMAGE_WARNING_RE =
  /missing an attached image|Unresolved image|Stem\/stimulus image|image that still needs|image refs|table or messy formatting|Clean up the text or attach the image/i;
/** Only cleared when correctAnswer is already set (script-local; not global STEM clear). */
const ANSWER_LOOKS_LIKE_IMAGE_RE = /Answer looks like an image/i;

const STEM_ONLY_TBL_RE = /^\s*\[tbl-\d+\.html\](?:\([^)]*\))?\s*$/i;

function parseWarnings(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function stripIngestImagePlaceholders(value) {
  if (!value) return "";
  return value
    .replace(BLANK_TBL_BLEED_RE, "$1")
    .replace(ORPHAN_TRAILING_TBL_RE, "$1")
    .replace(MD_IMAGE_RE, "")
    .replace(TBL_ASSET_RE, "")
    .replace(FIGURE_BRACKET_PLACEHOLDER_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasPlaceholderLeftover(value) {
  if (!value) return false;
  return (
    /!\[[^\]]*]\([^)]*\)/.test(value) ||
    /\[tbl-\d+\.html\]/i.test(value) ||
    /\[[^\]]*(?:graph|figure|chart|histogram|scatter(?:\s*plot)?|table)[^\]]*\]/i.test(value)
  );
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

const stemLinks = new Set(
  db
    .prepare(`SELECT candidateId FROM IngestCandidateImageLink WHERE targetType = 'STEM'`)
    .all()
    .map((row) => row.candidateId),
);

const candidates = db
  .prepare(
    `
  SELECT c.id, c.stem, c.stimulus, c.warningsJson, c.correctAnswer, c.officialQuestionId,
         c.topicName, c.difficulty, c.questionNumber, c.promotionStatus
  FROM IngestQuestionCandidate c
  WHERE c.contentType = 'PRACTICE_SET'
    AND c.status != 'REJECTED'
    AND c.promotionStatus != 'REJECTED'
`,
  )
  .all();

const getOfficial = db.prepare(
  `SELECT id, stem, stimulus, imageUrl, correctAnswer FROM Question WHERE id = ?`,
);

const planned = {
  stripCandidate: [],
  stripOfficial: [],
  clearWarnings: [],
  clearAnswerImageWarn: [],
  skippedNoImage: 0,
  skippedStemOnlyTbl: 0,
  scanned: candidates.length,
};

for (const c of candidates) {
  const official = c.officialQuestionId ? getOfficial.get(c.officialQuestionId) : null;
  const hasImage =
    stemLinks.has(c.id) || Boolean(official?.imageUrl && String(official.imageUrl).trim());

  if (!hasImage) {
    planned.skippedNoImage += 1;
    continue;
  }

  // Never empty a stem that is only a tbl placeholder (shouldn't happen with image, but guard).
  const stemOnlyTbl = STEM_ONLY_TBL_RE.test(c.stem || "") || STEM_ONLY_TBL_RE.test(official?.stem || "");
  if (stemOnlyTbl && !(c.stem || "").replace(TBL_ASSET_RE, "").trim() && !(official?.stem || "").replace(TBL_ASSET_RE, "").trim()) {
    planned.skippedStemOnlyTbl += 1;
    continue;
  }

  const nextStem = stripIngestImagePlaceholders(c.stem);
  const nextStimulus = stripIngestImagePlaceholders(c.stimulus);
  const stemChanged = nextStem !== (c.stem ?? "").trim();
  const stimulusChanged = nextStimulus !== (c.stimulus ?? "").trim();
  // Refuse strip if it would empty a previously non-empty stem that was only placeholders
  // and we somehow got here — keep original.
  const wouldEmptyStem = Boolean((c.stem || "").trim()) && !nextStem;
  if (wouldEmptyStem && STEM_ONLY_TBL_RE.test(c.stem || "")) {
    planned.skippedStemOnlyTbl += 1;
    continue;
  }

  if (stemChanged || stimulusChanged) {
    if (hasPlaceholderLeftover(`${c.stem || ""}\n${c.stimulus || ""}`) || stemChanged || stimulusChanged) {
      planned.stripCandidate.push({
        id: c.id,
        label: [c.difficulty, c.topicName, c.questionNumber != null ? `Q${c.questionNumber}` : null]
          .filter(Boolean)
          .join(" · "),
        stemChanged,
        stimulusChanged,
      });
    }
  }

  if (official) {
    const oStem = stripIngestImagePlaceholders(official.stem);
    const oStim = stripIngestImagePlaceholders(official.stimulus);
    if (oStem !== (official.stem ?? "").trim() || oStim !== (official.stimulus ?? "").trim()) {
      if (!(STEM_ONLY_TBL_RE.test(official.stem || "") && !oStem)) {
        planned.stripOfficial.push({
          id: official.id,
          candidateId: c.id,
          stemChanged: oStem !== (official.stem ?? "").trim(),
          stimulusChanged: oStim !== (official.stimulus ?? "").trim(),
        });
      }
    }
  }

  const warnings = parseWarnings(c.warningsJson);
  let nextWarnings = warnings.filter((w) => !OBSOLETE_IMAGE_WARNING_RE.test(w));
  const answer =
    (official?.correctAnswer && String(official.correctAnswer).trim()) ||
    (c.correctAnswer && String(c.correctAnswer).trim()) ||
    "";
  if (answer) {
    const before = nextWarnings.length;
    nextWarnings = nextWarnings.filter((w) => !ANSWER_LOOKS_LIKE_IMAGE_RE.test(w));
    if (nextWarnings.length < before) {
      planned.clearAnswerImageWarn.push({
        id: c.id,
        label: [c.difficulty, c.topicName, c.questionNumber != null ? `Q${c.questionNumber}` : null]
          .filter(Boolean)
          .join(" · "),
        answer,
      });
    }
  }
  if (JSON.stringify(nextWarnings) !== JSON.stringify(warnings)) {
    const clearedObsolete = warnings.length - warnings.filter((w) => !OBSOLETE_IMAGE_WARNING_RE.test(w)).length;
    if (clearedObsolete > 0 || nextWarnings.length !== warnings.length) {
      planned.clearWarnings.push({
        id: c.id,
        from: warnings.length,
        to: nextWarnings.length,
        label: [c.difficulty, c.topicName, c.questionNumber != null ? `Q${c.questionNumber}` : null]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }
}

console.log(`Scanned ${planned.scanned} PRACTICE_SET candidates.`);
console.log(`Skipped (no STEM/official image): ${planned.skippedNoImage}`);
console.log(`Skipped (stem-only tbl guard): ${planned.skippedStemOnlyTbl}`);
console.log(`Would strip candidate text: ${planned.stripCandidate.length}`);
console.log(`Would strip official text: ${planned.stripOfficial.length}`);
console.log(`Would clear warningsJson: ${planned.clearWarnings.length}`);
console.log(`  of which Answer-looks-like-image (answer set): ${planned.clearAnswerImageWarn.length}`);

for (const row of planned.stripCandidate.slice(0, 15)) {
  console.log(`  strip cand: ${row.label} (${row.id.slice(0, 16)}…)`);
}
if (planned.stripCandidate.length > 15) console.log(`  … +${planned.stripCandidate.length - 15} more`);

for (const row of planned.clearAnswerImageWarn.slice(0, 15)) {
  console.log(`  clear ans-image warn: ${row.label} ans=${row.answer}`);
}
if (planned.clearAnswerImageWarn.length > 15) {
  console.log(`  … +${planned.clearAnswerImageWarn.length - 15} more`);
}

if (!apply) {
  console.log("\nDry-run only. Re-run with --apply --confirm-server-stopped to write.");
  db.close();
  process.exit(0);
}

const updateCand = db.prepare(`
  UPDATE IngestQuestionCandidate
  SET stem = ?, stimulus = ?, warningsJson = ?, updatedAt = datetime('now')
  WHERE id = ?
`);
const updateOfficial = db.prepare(`
  UPDATE Question SET stem = ?, stimulus = ? WHERE id = ?
`);

const tx = db.transaction(() => {
  let candUpdated = 0;
  let officialUpdated = 0;

  for (const c of candidates) {
    const official = c.officialQuestionId ? getOfficial.get(c.officialQuestionId) : null;
    const hasImage =
      stemLinks.has(c.id) || Boolean(official?.imageUrl && String(official.imageUrl).trim());
    if (!hasImage) continue;

    // Guard: never empty a stem that is only [tbl-N.html]
    if (STEM_ONLY_TBL_RE.test((c.stem || "").trim())) {
      continue;
    }

    const nextStem = stripIngestImagePlaceholders(c.stem);
    const nextStimulus = stripIngestImagePlaceholders(c.stimulus);

    const warnings = parseWarnings(c.warningsJson);
    let nextWarnings = warnings.filter((w) => !OBSOLETE_IMAGE_WARNING_RE.test(w));
    const answer =
      (official?.correctAnswer && String(official.correctAnswer).trim()) ||
      (c.correctAnswer && String(c.correctAnswer).trim()) ||
      "";
    if (answer) {
      nextWarnings = nextWarnings.filter((w) => !ANSWER_LOOKS_LIKE_IMAGE_RE.test(w));
    }

    const stemChanged = nextStem !== (c.stem ?? "").trim();
    const stimulusChanged = nextStimulus !== (c.stimulus ?? "").trim();
    const warningsChanged = JSON.stringify(nextWarnings) !== JSON.stringify(warnings);

    if (stemChanged || stimulusChanged || warningsChanged) {
      updateCand.run(
        stemChanged ? nextStem || null : c.stem,
        stimulusChanged ? nextStimulus || null : c.stimulus,
        warningsChanged ? JSON.stringify(nextWarnings) : c.warningsJson,
        c.id,
      );
      candUpdated += 1;
    }

    if (official) {
      if (STEM_ONLY_TBL_RE.test((official.stem || "").trim())) continue;
      const oStem = stripIngestImagePlaceholders(official.stem);
      const oStim = stripIngestImagePlaceholders(official.stimulus);
      if (oStem !== (official.stem ?? "").trim() || oStim !== (official.stimulus ?? "").trim()) {
        updateOfficial.run(oStem || official.stem, oStim || null, official.id);
        officialUpdated += 1;
      }
    }
  }

  return { candUpdated, officialUpdated };
});

const result = tx();
console.log(`\nApplied. Candidates updated: ${result.candUpdated}; officials updated: ${result.officialUpdated}.`);
db.close();
