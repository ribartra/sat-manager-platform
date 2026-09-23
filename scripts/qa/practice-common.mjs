// Read-only resolver for MATH Practice Sets QA (published vs source). Never writes.
// Reuses openDb/remapAppPath from qa-common.mjs.
import fs from "node:fs";
import path from "node:path";
import { openDb, remapAppPath } from "./qa-common.mjs";

const DIFF_TOKENS = { EASY: ["easy"], MEDIUM: ["med", "medium"], HARD: ["hard"] };

// Find the sibling "ANS ..." pdf in the exercise pdf's folder matching the difficulty.
function findAnsPdf(exerciseAbs, difficulty) {
  if (!exerciseAbs) return null;
  const dir = path.dirname(exerciseAbs);
  if (!fs.existsSync(dir)) return null;
  const toks = DIFF_TOKENS[difficulty] || [String(difficulty || "").toLowerCase()];
  const files = fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f));
  const ansFiles = files.filter((f) => /^ans\b|\bans\s/i.test(f) || /^ans/i.test(f.trim()));
  // prefer an ANS file whose name contains a difficulty token
  const byDiff = ansFiles.filter((f) => toks.some((t) => f.toLowerCase().includes(t)));
  const pick = (byDiff[0] || ansFiles[0]) || null;
  return pick ? path.join(dir, pick) : null;
}

export function resolveMathPracticeSets(db) {
  const sets = db.prepare(`
    SELECT ps.id AS setId, ps.name AS name, ps.difficulty AS difficulty, ps.status AS status,
           t.name AS topic, d.name AS domain
    FROM PracticeSet ps
    JOIN Topic t ON t.id = ps.topicId
    JOIN Domain d ON d.id = t.domainId
    JOIN Section s ON s.id = d.sectionId
    WHERE s.name = 'MATH' AND d.name <> 'Full Practice Test'
    ORDER BY d.name, t.name, ps.difficulty
  `).all();

  const qStmt = db.prepare(`
    SELECT q.id AS qid, q.type AS type, q.stem AS stem, q.stimulus AS stimulus,
           q.correctAnswer AS correctAnswer, q.imageUrl AS imageUrl, q.difficulty AS qDifficulty,
           psq."order" AS ord,
           c.id AS candId, c.questionNumber AS seq, c.answerSource AS answerSource,
           c.pageArtifactId AS pageArtifactId,
           sf.path AS sourcePath, pa.pageNumber AS pageNumber
    FROM PracticeSetQuestion psq
    JOIN Question q ON q.id = psq.questionId
    LEFT JOIN IngestQuestionCandidate c ON c.officialQuestionId = q.id
    LEFT JOIN IngestSourceFile sf ON sf.id = c.sourceFileId
    LEFT JOIN IngestPageArtifact pa ON pa.id = c.pageArtifactId
    WHERE psq.practiceSetId = ?
    ORDER BY psq."order"
  `);
  const optStmt = db.prepare(`SELECT label, text, imageUrl FROM QuestionOption WHERE questionId = ? ORDER BY label ASC`);

  return sets.map((s) => {
    const rows = qStmt.all(s.setId);
    let exerciseAbs = null;
    for (const r of rows) { if (r.sourcePath) { exerciseAbs = remapAppPath(r.sourcePath); break; } }
    const ansAbs = findAnsPdf(exerciseAbs, s.difficulty);
    const questions = rows.map((r) => ({
      qid: r.qid, type: r.type, stem: r.stem, stimulus: r.stimulus,
      correctAnswer: r.correctAnswer, imageUrl: r.imageUrl,
      seq: r.seq, order: r.ord, candId: r.candId, answerSource: r.answerSource,
      pageArtifactId: r.pageArtifactId, pageNumber: r.pageNumber,
      sourcePathLocal: remapAppPath(r.sourcePath),
      options: optStmt.all(r.qid),
    }));
    return {
      setId: s.setId, name: s.name, domain: s.domain, topic: s.topic, difficulty: s.difficulty, status: s.status,
      exercisePdf: exerciseAbs, ansPdf: ansAbs,
      questions,
    };
  });
}

// Convenience filter for an agent working one domain (and optional topic subset).
export function filterSets(sets, { domain, topics } = {}) {
  return sets.filter((s) => (!domain || s.domain === domain) && (!topics || topics.includes(s.topic)));
}
