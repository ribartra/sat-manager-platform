// Read-only resolver for MATH Practice Sets QA (published vs source). Never writes.
// Reuses openDb/remapAppPath from qa-common.mjs.
import fs from "node:fs";
import path from "node:path";
import { openDb, remapAppPath } from "./qa-common.mjs";

const DIFF_TOKENS = { EASY: ["easy"], MEDIUM: ["med", "medium"], HARD: ["hard"] };

// Set number after a difficulty word in a file name: "BOUNDARIES H1", "ANS BOUNDARIES H 2",
// "Boundaries Medium 1" / "Ans Boundaries Med 1", "HARD 1EQUIV" → "1"; null when the name has none.
function setNumber(fname) {
  const m = fname.toLowerCase().replace(/\.pdf$/, "").match(/(?:^|[\s.])(?:h|hard|med|medium|easy)\s*(\d)(?!\d)/);
  return m ? m[1] : null;
}

// Find the sibling "ANS ..." pdf in the exercise pdf's folder: the one with the same set number
// when the folder holds several sets of one difficulty (Boundaries H1/H2/H3, Med 1/2), else by difficulty.
function findAnsPdf(exerciseAbs, difficulty) {
  if (!exerciseAbs) return null;
  const dir = path.dirname(exerciseAbs);
  if (!fs.existsSync(dir)) return null;
  const toks = DIFF_TOKENS[difficulty] || [String(difficulty || "").toLowerCase()];
  const files = fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).sort();
  const ansFiles = files.filter((f) => /^ans\b|\bans\s/i.test(f) || /^ans/i.test(f.trim()));
  const num = setNumber(path.basename(exerciseAbs));
  const byNum = num ? ansFiles.filter((f) => setNumber(f) === num) : [];
  if (byNum.length === 1) return path.join(dir, byNum[0]);
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

// Read-only resolver for READING Practice Sets QA (the Reading half of R&W).
// Section is 'READING_WRITING' in the DB ("R&W" is only a UI label). Reading = the two
// domains 'Information and Ideas' + 'Craft and Structure' (Writing domains are excluded).
// Adds questionExternalId (the "Question ID: <hex>" that also appears in the exercise/ANS
// PDFs) and explanation, so callers can join answer keys by hex without fuzzy filename
// matching. Reading PDFs carry no images, so imageUrl is not surfaced. Never writes.
export function resolveReadingPracticeSets(db) {
  const sets = db.prepare(`
    SELECT ps.id AS setId, ps.name AS name, ps.difficulty AS difficulty, ps.status AS status,
           t.name AS topic, d.name AS domain
    FROM PracticeSet ps
    JOIN Topic t ON t.id = ps.topicId
    JOIN Domain d ON d.id = t.domainId
    JOIN Section s ON s.id = d.sectionId
    WHERE s.name = 'READING_WRITING'
      AND d.name IN ('Information and Ideas', 'Craft and Structure')
    ORDER BY d.name, t.name, ps.difficulty
  `).all();

  const qStmt = db.prepare(`
    SELECT q.id AS qid, q.type AS type, q.stem AS stem, q.stimulus AS stimulus,
           q.correctAnswer AS correctAnswer, q.explanation AS explanation, q.difficulty AS qDifficulty,
           psq."order" AS ord,
           c.id AS candId, c.questionNumber AS seq, c.questionExternalId AS externalId,
           c.answerSource AS answerSource, c.rawJson AS rawJson,
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
    const questions = rows.map((r) => {
      let sourceText = null;
      if (r.rawJson) { try { sourceText = JSON.parse(r.rawJson).text ?? null; } catch { sourceText = null; } }
      return {
        qid: r.qid, type: r.type, stem: r.stem, stimulus: r.stimulus,
        correctAnswer: r.correctAnswer, explanation: r.explanation,
        seq: r.seq, order: r.ord, candId: r.candId, externalId: r.externalId,
        answerSource: r.answerSource, sourceText,
        pageArtifactId: r.pageArtifactId, pageNumber: r.pageNumber,
        sourcePathLocal: remapAppPath(r.sourcePath),
        options: optStmt.all(r.qid),
      };
    });
    return {
      setId: s.setId, name: s.name, domain: s.domain, topic: s.topic, difficulty: s.difficulty, status: s.status,
      exercisePdf: exerciseAbs, ansPdf: ansAbs,
      questions,
    };
  });
}

// Read-only resolver for WRITING Practice Sets QA (the Writing half of R&W).
// Same shape/joins as resolveReadingPracticeSets, but Writing = the two domains
// 'Expression of Ideas' + 'Standard English Conventions'. Surfaces questionExternalId
// (the "Question ID: <hex>" in the exercise/ANS PDFs) + explanation + rawJson.text as
// sourceText, so answer keys join by hex and published-vs-source is a text diff.
// Note: 'Boundaries' is ingested as several sets at the same difficulty (one per source
// file: H1/H2/H3, Med 1/2). Writing PDFs carry no raster images. Never writes.
export function resolveWritingPracticeSets(db) {
  const sets = db.prepare(`
    SELECT ps.id AS setId, ps.name AS name, ps.difficulty AS difficulty, ps.status AS status,
           t.name AS topic, d.name AS domain
    FROM PracticeSet ps
    JOIN Topic t ON t.id = ps.topicId
    JOIN Domain d ON d.id = t.domainId
    JOIN Section s ON s.id = d.sectionId
    WHERE s.name = 'READING_WRITING'
      AND d.name IN ('Expression of Ideas', 'Standard English Conventions')
    ORDER BY d.name, t.name, ps.difficulty, ps.id
  `).all();

  const qStmt = db.prepare(`
    SELECT q.id AS qid, q.type AS type, q.stem AS stem, q.stimulus AS stimulus,
           q.correctAnswer AS correctAnswer, q.explanation AS explanation, q.difficulty AS qDifficulty,
           psq."order" AS ord,
           c.id AS candId, c.questionNumber AS seq, c.questionExternalId AS externalId,
           c.answerSource AS answerSource, c.rawJson AS rawJson,
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
    const questions = rows.map((r) => {
      let sourceText = null;
      if (r.rawJson) { try { sourceText = JSON.parse(r.rawJson).text ?? null; } catch { sourceText = null; } }
      return {
        qid: r.qid, type: r.type, stem: r.stem, stimulus: r.stimulus,
        correctAnswer: r.correctAnswer, explanation: r.explanation,
        seq: r.seq, order: r.ord, candId: r.candId, externalId: r.externalId,
        answerSource: r.answerSource, sourceText,
        pageArtifactId: r.pageArtifactId, pageNumber: r.pageNumber,
        sourcePathLocal: remapAppPath(r.sourcePath),
        options: optStmt.all(r.qid),
      };
    });
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
