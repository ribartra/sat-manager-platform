import "server-only";
import prisma from "@/lib/prisma";
import {
  buildQuestionContent,
  classifyQuestion,
  reviewLevelFromStatus,
  type ExtractedTestFile,
  type ExtractedTestFileRole,
  type ExtractedTestRow,
  type QuestionStatusRow,
} from "@/lib/ingest-sets";

// Groups a batch's source files into ExtractedTest rows — the set of files that
// together make one staging unit (Full Practice Test section, or Practice Set +
// answer key) — with live per-question completeness.

function textOptionCount(optionsJson: string | null): number {
  if (!optionsJson) return 0;
  try {
    const parsed = JSON.parse(optionsJson);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((option) => typeof option?.text === "string" && option.text.trim()).length;
  } catch {
    return 0;
  }
}

function sectionKind(section: string | null | undefined): string | null {
  if (!section) return null;
  return section.toUpperCase().includes("MATH") ? "MATH" : "RW";
}

function fileName(relativePath: string): string {
  return relativePath.split("/").at(-1) || relativePath;
}

function fileRole(f: {
  isQuestionSource: boolean;
  isAnswerFile: boolean;
  isExplanationFile: boolean;
  sourceKind: string | null;
}): ExtractedTestFileRole {
  if (f.isExplanationFile || f.sourceKind === "ANSWER_EXPLANATION") return "EXPLANATION";
  if (f.isAnswerFile || f.sourceKind === "ANSWER_KEY") return "ANSWER";
  if (f.isQuestionSource) return "QUESTION";
  return "OTHER";
}

export async function computeExtractedTests(batchId: string): Promise<ExtractedTestRow[]> {
  const [sources, candidates, answerCounts, imageLinks] = await Promise.all([
    prisma.ingestSourceFile.findMany({
      where: { batchId, contentType: { in: ["PRACTICE_SET", "FULL_PRACTICE_TEST"] } },
      select: {
        id: true,
        relativePath: true,
        contentType: true,
        sourceKind: true,
        section: true,
        topicName: true,
        difficulty: true,
        practiceSetVariant: true,
        testNumber: true,
        status: true,
        isQuestionSource: true,
        isAnswerFile: true,
        isExplanationFile: true,
      },
    }),
    prisma.ingestQuestionCandidate.findMany({
      where: { batchId, contentType: { in: ["PRACTICE_SET", "FULL_PRACTICE_TEST"] } },
      select: {
        id: true,
        sourceFileId: true,
        questionNumber: true,
        moduleLabel: true,
        section: true,
        type: true,
        correctAnswer: true,
        optionsJson: true,
        stem: true,
        stimulus: true,
        explanation: true,
        promotionStatus: true,
        officialQuestionId: true,
        status: true,
      },
    }),
    prisma.ingestAnswerCandidate.groupBy({ by: ["sourceFileId"], where: { batchId }, _count: { _all: true } }),
    prisma.ingestCandidateImageLink.findMany({
      where: { batchId },
      select: { candidateId: true, targetType: true, optionLabel: true },
    }),
  ]);

  const optionBlock = new Set<string>();
  const optionLetters = new Map<string, Set<string>>();
  const stemImageLinks = new Set<string>();
  const stimulusImageLinks = new Set<string>();
  for (const link of imageLinks) {
    if (link.targetType === "STEM") {
      stemImageLinks.add(link.candidateId);
    } else if (link.targetType === "STIMULUS") {
      stimulusImageLinks.add(link.candidateId);
    } else if (link.targetType === "OPTION_BLOCK") {
      optionBlock.add(link.candidateId);
    } else if (link.targetType === "OPTION" && link.optionLabel) {
      const set = optionLetters.get(link.candidateId) ?? new Set<string>();
      set.add(link.optionLabel.toUpperCase());
      optionLetters.set(link.candidateId, set);
    }
  }

  const officialIds = candidates
    .filter((c) => c.promotionStatus === "PROMOTED" && c.officialQuestionId)
    .map((c) => c.officialQuestionId as string);
  const [officialQuestions, officialOptions] = await Promise.all([
    prisma.question.findMany({
      where: { id: { in: officialIds } },
      select: { id: true, stem: true, stimulus: true, explanation: true, type: true, correctAnswer: true, imageUrl: true },
    }),
    prisma.questionOption.findMany({
      where: { questionId: { in: officialIds } },
      select: { questionId: true, text: true, imageUrl: true },
    }),
  ]);
  const officialById = new Map(officialQuestions.map((q) => [q.id, q]));
  const officialOptCounts = new Map<string, { text: number; img: number }>();
  for (const o of officialOptions) {
    const c = officialOptCounts.get(o.questionId) ?? { text: 0, img: 0 };
    if (o.text && o.text.trim()) c.text += 1;
    if (o.imageUrl) c.img += 1;
    officialOptCounts.set(o.questionId, c);
  }

  const answersByFile = new Map(answerCounts.map((a) => [a.sourceFileId, a._count._all] as const));
  const questionsByFile = new Map<string, number>();
  for (const c of candidates) {
    if (!c.sourceFileId) continue;
    if (c.status === "REJECTED" || c.promotionStatus === "REJECTED") continue;
    questionsByFile.set(c.sourceFileId, (questionsByFile.get(c.sourceFileId) ?? 0) + 1);
  }

  const testSections = new Map<number, Set<string>>();
  for (const s of sources) {
    if (s.testNumber == null) continue;
    const sk = sectionKind(s.section);
    if (!sk) continue;
    const set = testSections.get(s.testNumber) ?? new Set<string>();
    set.add(sk);
    testSections.set(s.testNumber, set);
  }

  const keysFor = (s: (typeof sources)[number]): string[] => {
    if (s.testNumber != null) {
      const sk = sectionKind(s.section);
      if (sk) return [`FULL|${s.testNumber}|${sk}`];
      const secs = [...(testSections.get(s.testNumber) ?? [])];
      return secs.length ? secs.map((x) => `FULL|${s.testNumber}|${x}`) : [`FULL|${s.testNumber}|?`];
    }
    return [
      `PRACTICE|${sectionKind(s.section) ?? "?"}|${s.topicName ?? ""}|${s.difficulty ?? ""}|${s.practiceSetVariant ?? ""}`,
    ];
  };

  const groups = new Map<string, (typeof sources)[number][]>();
  for (const s of sources) {
    for (const key of keysFor(s)) {
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
  }

  const candidateKeyByFile = new Map<string, string>();
  for (const s of sources) candidateKeyByFile.set(s.id, keysFor(s)[0]);
  const candidatesByKey = new Map<string, typeof candidates>();
  for (const c of candidates) {
    if (!c.sourceFileId) continue;
    if (c.status === "REJECTED" || c.promotionStatus === "REJECTED") continue;
    const key = candidateKeyByFile.get(c.sourceFileId);
    if (!key) continue;
    const arr = candidatesByKey.get(key) ?? [];
    arr.push(c);
    candidatesByKey.set(key, arr);
  }

  const rows: ExtractedTestRow[] = [];
  for (const [key, files] of groups) {
    const isFull = key.startsWith("FULL|");
    const parts = key.split("|");
    const testNumber = isFull ? Number(parts[1]) : null;
    const section = (isFull ? parts[2] : parts[1]) === "?" ? null : isFull ? parts[2] : parts[1];
    const contentType = isFull ? "FULL_PRACTICE_TEST" : "PRACTICE_SET";
    const difficulty = files.find((f) => f.difficulty)?.difficulty ?? null;
    const topicName = files.find((f) => f.topicName)?.topicName ?? null;
    const variant = files.find((f) => f.practiceSetVariant)?.practiceSetVariant ?? null;

    const extractedFiles: ExtractedTestFile[] = files
      .map((f) => ({
        id: f.id,
        name: fileName(f.relativePath),
        role: fileRole(f),
        nQ: questionsByFile.get(f.id) ?? 0,
        nA: answersByFile.get(f.id) ?? 0,
      }))
      .sort((a, b) => (a.role === "QUESTION" ? -1 : b.role === "QUESTION" ? 1 : 0) || b.nQ - a.nQ);

    const primary =
      [...extractedFiles].sort(
        (a, b) => (b.role === "QUESTION" ? 1 : 0) - (a.role === "QUESTION" ? 1 : 0) || b.nQ - a.nQ,
      )[0] ?? extractedFiles[0];

    const title =
      testNumber != null
        ? `Test ${testNumber}${section ? ` · ${section === "MATH" ? "Math" : "R&W"}` : ""}`
        : [topicName || primary?.name || "Extracted Test", difficulty, variant ? `v${variant}` : null]
            .filter(Boolean)
            .join(" · ");

    const questions: QuestionStatusRow[] = [];
    let complete = 0;
    let attention = 0;
    let needsReview = 0;
    let missingStem = 0;
    let missingStimulus = 0;
    let missingOptions = 0;
    let missingAnswer = 0;
    let missingExplanation = 0;
    let promoted = 0;

    for (const c of candidatesByKey.get(key) ?? []) {
      const isPromoted = c.promotionStatus === "PROMOTED" && !!c.officialQuestionId;
      const official = isPromoted ? officialById.get(c.officialQuestionId as string) : undefined;
      if (isPromoted) promoted += 1;

      // Prefer official content when promoted so rail /sets / file review share one truth.
      const content = official
        ? (() => {
            const oc = officialOptCounts.get(official.id) ?? { text: 0, img: 0 };
            return buildQuestionContent({
              type: official.type,
              correctAnswer: official.correctAnswer,
              stem: official.stem,
              stimulus: official.stimulus,
              explanation: official.explanation,
              section: section ?? sectionKind(c.section),
              optTextCount: oc.text,
              optImgCount: oc.img,
              hasStemImageLink:
                !!(official.imageUrl && official.imageUrl.trim()) || stemImageLinks.has(c.id),
              hasStimulusImageLink: stimulusImageLinks.has(c.id),
            });
          })()
        : buildQuestionContent({
            type: c.type,
            correctAnswer: c.correctAnswer,
            stem: c.stem,
            stimulus: c.stimulus,
            explanation: c.explanation,
            section: section ?? sectionKind(c.section),
            optTextCount: textOptionCount(c.optionsJson),
            optImgCount: optionBlock.has(c.id) ? 4 : (optionLetters.get(c.id)?.size ?? 0),
            hasStemImageLink: stemImageLinks.has(c.id),
            hasStimulusImageLink: stimulusImageLinks.has(c.id),
          });

      const cls = classifyQuestion(content);
      // Pending is governed by the CURATED candidate status (what the file-review
      // UI sets), so the review stays coherent with the QA truth instead of the
      // noisy completeness heuristic. classifyQuestion is kept only for the advisory
      // per-field dots/notes (missingStem/…) shown to guide the correction.
      const level = reviewLevelFromStatus(c.status, c.promotionStatus);
      if (level === "crit") needsReview += 1;
      else if (level === "warn") attention += 1;
      else complete += 1;
      if (cls.fields.stem === "crit") missingStem += 1;
      if (cls.fields.stimulus === "warn") missingStimulus += 1;
      if (cls.fields.options === "crit") missingOptions += 1;
      if (cls.fields.answer === "crit") missingAnswer += 1;
      if (cls.fields.explanation === "info") missingExplanation += 1;

      questions.push({
        candidateId: c.id,
        sourceFileId: c.sourceFileId as string,
        questionNumber: c.questionNumber,
        moduleLabel: c.moduleLabel,
        type: content.type,
        answer: content.correctAnswer ?? "",
        promoted: isPromoted,
        level,
        fields: cls.fields,
        notes: cls.notes,
      });
    }

    questions.sort(
      (a, b) =>
        (a.moduleLabel ?? "").localeCompare(b.moduleLabel ?? "") ||
        (a.questionNumber ?? 0) - (b.questionNumber ?? 0),
    );

    rows.push({
      key,
      batchId,
      primaryFileId: primary?.id ?? files[0].id,
      title,
      contentType,
      section,
      difficulty,
      testNumber,
      files: extractedFiles,
      fileIds: files.map((f) => f.id),
      total: questions.length,
      complete,
      attention,
      needsReview,
      missingStem,
      missingStimulus,
      missingOptions,
      missingAnswer,
      missingExplanation,
      promoted,
      questions,
    });
  }

  return rows.sort((a, b) => {
    const ta = a.testNumber ?? Number.POSITIVE_INFINITY;
    const tb = b.testNumber ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    const sa = a.section === "MATH" ? 1 : 0;
    const sb = b.section === "MATH" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Candidates + answers for the file review UI, scoped to the whole Extracted Test
 * when this file belongs to one. Question images often live on the QUESTION DOCX
 * while staging rows live on ANSWER_EXPLANATION — reviewers must see the same
 * question list on either file.
 */
export function resolveExtractedTestScope(
  setRows: ExtractedTestRow[],
  fileId: string,
): {
  extractedTest: ExtractedTestRow | null;
  candidateSourceFileIds: string[];
  ownQuestionCount: number;
  scopedFromSiblings: boolean;
} {
  const extractedTest = setRows.find((row) => row.fileIds.includes(fileId)) ?? null;
  if (!extractedTest) {
    return {
      extractedTest: null,
      candidateSourceFileIds: [fileId],
      ownQuestionCount: 0,
      scopedFromSiblings: false,
    };
  }
  const ownQuestionCount = extractedTest.files.find((f) => f.id === fileId)?.nQ ?? 0;
  const idsWithQuestions = extractedTest.files.filter((f) => f.nQ > 0).map((f) => f.id);
  const candidateSourceFileIds = idsWithQuestions.length > 0 ? idsWithQuestions : extractedTest.fileIds;
  return {
    extractedTest,
    candidateSourceFileIds,
    ownQuestionCount,
    scopedFromSiblings: ownQuestionCount === 0 && candidateSourceFileIds.some((id) => id !== fileId),
  };
}
