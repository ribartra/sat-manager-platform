// Images and source files of imported content (Import with AI and the OCR AI Import): who may open a
// batch, the artifacts zip (original files + pages + prompts) and the images zip whose images are
// linked to their questions and copied to the official ones. Shared by the Import with AI wizard and
// the editors' "Images & source files" shortcuts.
import prisma from "@/lib/prisma";
import { contentScopeFor } from "@/lib/program-scope";
import { ApiError, NotFoundError } from "@/lib/api-error";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { propagateAssignedImageToOfficial } from "@/lib/ingest-promotion";
import { toCsv } from "@/lib/csv";
import { buildCsvPrompt, buildImagePrompt, parseTarget, QUICK_IMPORT_COLUMNS, TEST_MODULES, testModuleIndex } from "@/lib/quick-import";
import { reconcileFigureReview } from "@/lib/ingest-review";

type User = { id: string; role: string };

/**
 * An import batch the user may work with: admins any; others the batches they started, or a batch
 * whose promoted questions are in their content scope (the program bank they teach).
 */
export async function loadImportBatch(batchId: string, user: User) {
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("Import not found.");
  if (user.role === "ADMIN" || batch.createdById === user.id) return batch;
  const promoted = await prisma.ingestQuestionCandidate.findMany({
    where: { batchId, officialQuestionId: { not: null } },
    select: { officialQuestionId: true },
    take: 500,
  });
  const ids = promoted.map((c) => c.officialQuestionId!).filter(Boolean);
  const inScope = ids.length ? await prisma.question.count({ where: { id: { in: ids }, ...contentScopeFor(user) } }) : 0;
  if (!inScope) throw new NotFoundError("Import not found.");
  return batch;
}

const isTestCandidate = (c: { contentType: string | null }) => c.contentType === "FULL_PRACTICE_TEST";
const moduleCode = (c: { contentType: string | null; section: string | null; moduleLabel: string | null }) =>
  isTestCandidate(c) ? TEST_MODULES[testModuleIndex({ section: c.section === "MATH" ? "MATH" : "RW", moduleLabel: c.moduleLabel })] : null;

function rawOf(json: string) {
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Image-recovery prompt for the given candidates (all of the batch, or one set / test's). */
export function imagePromptFor(candidates: Array<{ questionNumber: number | null; contentType: string | null; section: string | null; moduleLabel: string | null; rawJson: string }>) {
  const flagged = candidates.map((c) => {
    const raw = rawOf(c.rawJson);
    const figure = (raw.figure || "").toUpperCase();
    return {
      number: c.questionNumber ?? 0,
      module: moduleCode(c),
      figure: figure && figure !== "NONE" ? `${figure.toLowerCase()}${raw.figurePage ? ` (page ${raw.figurePage})` : ""}` : "",
    };
  });
  // CSV imports flag their figures; OCR imports don't, so every question is listed.
  const withFigure = flagged.filter((q) => q.figure);
  return buildImagePrompt((withFigure.length ? withFigure : flagged.map((q) => ({ ...q, figure: "check for figures / image choices" }))).filter((q) => q.number > 0));
}

/** Zip with the batch's original files, every page as PNG, its questions (CSV) and the prompts. */
export async function buildArtifactsZip(batchId: string) {
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId }, select: { targetJson: true } });
  const candidates = await prisma.ingestQuestionCandidate.findMany({
    where: { batchId, status: { not: "REJECTED" } },
    orderBy: [{ sourceFileId: "asc" }, { section: "asc" }, { moduleLabel: "asc" }, { questionNumber: "asc" }],
  });
  const csv = toCsv([
    [...QUICK_IMPORT_COLUMNS],
    ...candidates.map((c) => {
      let options: Record<string, string> = {};
      try {
        options = (JSON.parse(c.optionsJson ?? "[]") as Array<{ label: string; text: string }>).reduce<Record<string, string>>((map, o) => ({ ...map, [o.label]: o.text }), {});
      } catch {
        options = {};
      }
      const raw = rawOf(c.rawJson);
      return [c.questionNumber, moduleCode(c), c.domainName, c.topicName, c.difficulty, c.type, c.stimulus, c.stem, options.A, options.B, options.C, options.D, c.correctAnswer, c.explanation, raw.figure || "NONE", raw.figurePage, raw.notes];
    }),
  ]);
  const target = parseTarget(batch?.targetJson);
  const files: Record<string, string> = { "candidates.csv": csv, "PROMPT-images.md": imagePromptFor(candidates) };
  if (target) files["PROMPT-csv.md"] = buildCsvPrompt(target);
  const res = await fetch(ingestUrl(`/batches/${batchId}/artifacts.zip`), {
    method: "POST",
    headers: ingestAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw ApiError.fromStatus(res.status, "The import service could not build the zip.");
  return res.arrayBuffer();
}

/**
 * Images zip from the external AI (Q3_STEM.png, Q5_A.png; Tests RW1_Q3_STEM.png…): the ingest service
 * links each image to its question's slot; questions already published as official ones get it too.
 */
export async function uploadImagesZip(batchId: string, file: File, candidateIds: string[] = []) {
  const upstream = new FormData();
  upstream.set("file", file, file.name);
  // Scope to one set / test's questions (an OCR batch repeats question numbers across its files).
  if (candidateIds.length) upstream.set("candidateIds", candidateIds.join(","));
  const res = await fetch(ingestUrl(`/batches/${batchId}/image-zip`), { method: "POST", headers: ingestAuthHeaders(), body: upstream });
  const data = (await res.json().catch(() => ({}))) as {
    linked?: Array<{ candidateId?: string; imageArtifactId: string; targetType?: string; optionLabel?: string | null }>;
    skipped?: string[];
    detail?: string;
  };
  if (!res.ok) throw ApiError.fromStatus(res.status, data.detail || "The import service could not read the zip.");
  let propagated = 0;
  for (const link of data.linked ?? []) {
    if (!link.candidateId || !link.targetType) continue;
    const result = await propagateAssignedImageToOfficial({
      candidateId: link.candidateId,
      imageArtifactId: link.imageArtifactId,
      targetType: link.targetType,
      optionLabel: link.optionLabel ?? null,
    });
    if (result.propagated) propagated += 1;
  }
  // A figure now attached resolves its "crop it" review reason (the question may become READY).
  await reconcileFigureReview((data.linked ?? []).flatMap((link) => (link.candidateId ? [link.candidateId] : [])));
  return { linked: data.linked?.length ?? 0, propagated, skipped: data.skipped ?? [] };
}

/**
 * Where the questions of a Practice Set / Test came from: for each question imported (with Import with
 * AI or the OCR AI Import), its staging candidate and the review / crop page of that file.
 */
/** Candidates of this batch behind a Practice Set / Test ("practice-sets:<id>" / "tests:<id>"). */
export async function scopeCandidateIds(batchId: string, scope: string | null, user: User): Promise<string[]> {
  const [kind, id] = (scope ?? "").split(":");
  if (!id || (kind !== "practice-sets" && kind !== "tests")) return [];
  const where = { id, ...contentScopeFor(user) };
  const questionIds =
    kind === "practice-sets"
      ? ((await prisma.practiceSet.findFirst({ where, select: { questions: { select: { questionId: true } } } }))?.questions.map((q) => q.questionId) ?? [])
      : ((await prisma.fullPracticeTest.findFirst({ where, select: { modules: { select: { questions: { select: { questionId: true } } } } } }))?.modules.flatMap((m) => m.questions.map((q) => q.questionId)) ?? []);
  if (!questionIds.length) return [];
  const candidates = await prisma.ingestQuestionCandidate.findMany({ where: { batchId, officialQuestionId: { in: questionIds } }, select: { id: true } });
  return candidates.map((c) => c.id);
}

export async function importSourcesFor(questionIds: string[]) {
  if (!questionIds.length) return { batches: [], byQuestion: new Map<string, { candidateId: string; reviewHref: string; batchId: string; fileName: string }>() };
  const candidates = await prisma.ingestQuestionCandidate.findMany({
    where: { officialQuestionId: { in: questionIds }, promotionStatus: "PROMOTED" },
    select: { id: true, batchId: true, sourceFileId: true, officialQuestionId: true, questionNumber: true, contentType: true, section: true, moduleLabel: true, rawJson: true },
    orderBy: { updatedAt: "desc" },
  });
  // The name the images zip uses for this question (its number in the source file; Tests with module).
  const byQuestion = new Map<string, { candidateId: string; reviewHref: string; batchId: string; fileName: string }>();
  for (const c of candidates) {
    if (!c.officialQuestionId || byQuestion.has(c.officialQuestionId)) continue;
    const moduleLabel = moduleCode(c);
    byQuestion.set(c.officialQuestionId, {
      candidateId: c.id,
      batchId: c.batchId,
      reviewHref: `/admin/import/ai/${c.batchId}/files/${c.sourceFileId}?candidate=${c.id}`,
      fileName: c.questionNumber ? `${moduleLabel ? `${moduleLabel}_` : ""}Q${c.questionNumber}_…` : "",
    });
  }
  const batchIds = [...new Set(candidates.map((c) => c.batchId))];
  const batchRows = batchIds.length ? await prisma.ingestBatch.findMany({ where: { id: { in: batchIds } }, select: { id: true, name: true, importMode: true, createdAt: true } }) : [];
  const batches = batchRows.map((batch) => ({
    ...batch,
    imagePrompt: imagePromptFor(candidates.filter((c) => c.batchId === batch.id)),
    questions: candidates.filter((c) => c.batchId === batch.id).length,
  }));
  return { batches, byQuestion };
}

/** Editor shortcuts for an imported Practice Set / Test (null when none of its questions was imported). */
export async function contentMediaLinks(kind: "practice-sets" | "tests", id: string, questionIds: string[]) {
  const { batches, byQuestion } = await importSourcesFor(questionIds);
  if (!batches.length) return null;
  return {
    href: `/teacher/media/${kind}/${id}`,
    cropByQuestion: Object.fromEntries([...byQuestion.entries()].map(([questionId, source]) => [questionId, source.reviewHref])),
  };
}
