import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertContentImporter } from "@/lib/rbac";
import { contentProgramFor } from "@/lib/program-scope";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, BadRequestError, PayloadTooLargeError, ServiceUnavailableError, ValidationError, withApiErrors } from "@/lib/api-error";
import { sourceIdIssue } from "@/lib/content-source";
import { resolvePracticeArea } from "@/lib/practice-area";
import { isOfficialSkill } from "@/lib/taxonomy-order";
import { writeAudit } from "@/lib/audit";
import { QUESTION_SLOTS, QUICK_IMPORT_MODE, type QuickFiles, type QuickFileSlot, type QuickImportTarget, type SectionLayout } from "@/lib/quick-import";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const LEVELS = new Set(["EASY", "MEDIUM", "HARD"]);

// POST /api/import/quick — "Import with AI", step 1: the target (Practice Set: skill + level; Test:
// number + name) + source + the original files (kept for cropping and the artifacts zip; no OCR).
// What each file is comes ONLY from the field it was uploaded in (on the deployed app the teacher just
// uploads files: names and folders mean nothing). Form: kind, sourceId, and
//   Practice Set: topicId, difficulty, Q (questions PDF), ANS* (answers / explanations, PDF or Word)
//   Test: testNumber, testName, layoutRW / layoutMATH = COMBINED (Module 1 + 2 in one file) |
//         PER_MODULE (one file per module); RW_Q | RW1_Q + RW2_Q, MATH_Q | MATH1_Q + MATH2_Q (PDF);
//         RW_ANS*, MATH_ANS* (that section's answers / explanations), KEY* (answer key for the whole
//         Test) — PDF or Word.
const isFile = (value: FormDataEntryValue | null): value is File => value instanceof File && value.size > 0;
const named = (file: File, name: string) => new File([file], name, { type: file.type });
/** Upload tag: the ingest service keeps the name, so "F03 - <original>" finds the file's slot again. */
const TAG = /^F(\d{2}) - /;
const SECTION_OF_SLOT: Partial<Record<QuickFileSlot, string>> = { RW_Q: "RW", RW1_Q: "RW", RW2_Q: "RW", RW_ANS: "RW", MATH_Q: "MATH", MATH1_Q: "MATH", MATH2_Q: "MATH", MATH_ANS: "MATH" };

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await assertContentImporter();
  const programId = await contentProgramFor(session.user);
  const form = await req.formData();
  const kind = String(form.get("kind") || "PRACTICE_SET").toUpperCase();
  const sourceId = String(form.get("sourceId") || "");

  if (kind !== "PRACTICE_SET" && kind !== "FULL_PRACTICE_TEST") throw new BadRequestError("Choose Practice Set or Test.");
  const sourceIssue = await sourceIdIssue(sourceId, kind === "PRACTICE_SET" ? "practice" : "tests");
  if (sourceIssue) throw new ValidationError("Validation failed.", [sourceIssue]);

  // The files of the slots that apply to the chosen options (a section's layout decides whether it
  // takes one questions file or one per module).
  const layoutOf = (section: "RW" | "MATH"): SectionLayout => (String(form.get(`layout${section}`) || "").toUpperCase() === "PER_MODULE" ? "PER_MODULE" : "COMBINED");
  const layout = { RW: layoutOf("RW"), MATH: layoutOf("MATH") };
  const slots: QuickFileSlot[] =
    kind === "PRACTICE_SET"
      ? ["Q", "ANS"]
      : [
          ...(layout.RW === "COMBINED" ? (["RW_Q"] as const) : (["RW1_Q", "RW2_Q"] as const)),
          ...(layout.MATH === "COMBINED" ? (["MATH_Q"] as const) : (["MATH1_Q", "MATH2_Q"] as const)),
          "RW_ANS",
          "MATH_ANS",
          "KEY",
        ];
  const uploads = slots.flatMap((slot) => {
    const files = form.getAll(slot).filter(isFile);
    return (QUESTION_SLOTS.has(slot) ? files.slice(0, 1) : files).map((file) => ({ slot, file }));
  });
  const questions = uploads.filter((u) => QUESTION_SLOTS.has(u.slot));
  const answers = uploads.filter((u) => !QUESTION_SLOTS.has(u.slot));
  if (questions.length === 0) throw new ValidationError("Validation failed.", [kind === "PRACTICE_SET" ? "Upload the questions PDF." : "Upload the questions of Reading and Writing or of Math."]);
  if (questions.some((u) => !u.file.name.toLowerCase().endsWith(".pdf"))) throw new ValidationError("Validation failed.", ["The questions must be PDF files (save a Word file as PDF)."]);
  if (answers.some((u) => !/\.(pdf|docx)$/i.test(u.file.name))) throw new ValidationError("Validation failed.", ["Answer keys and explanations must be PDF or Word (.docx) files."]);
  if (answers.length > 10) throw new ValidationError("Validation failed.", ["Upload at most 10 answer / explanation files."]);
  if (uploads.reduce((sum, u) => sum + u.file.size, 0) > MAX_UPLOAD_BYTES) throw new PayloadTooLargeError("Upload exceeds the 256 MB limit.");

  let target: QuickImportTarget;
  if (kind === "PRACTICE_SET") {
    const difficulty = String(form.get("difficulty") || "").toUpperCase();
    const topic = await prisma.topic.findUnique({
      where: { id: String(form.get("topicId") || "") },
      select: { id: true, name: true, domain: { select: { name: true, practiceArea: true } } },
    });
    const section = topic ? resolvePracticeArea(topic.domain) : null;
    if (!topic || !section || !isOfficialSkill(topic.id)) throw new ValidationError("Validation failed.", ["Choose the skill."]);
    if (!LEVELS.has(difficulty)) throw new ValidationError("Validation failed.", ["Choose Easy, Medium or Hard."]);
    target = { kind, topicId: topic.id, topicName: topic.name, domainName: topic.domain.name, section, difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" };
  } else {
    const testName = String(form.get("testName") || "").trim();
    const testNumber = Number(form.get("testNumber"));
    if (!Number.isInteger(testNumber) || testNumber < 1 || testNumber > 999) throw new ValidationError("Validation failed.", ["Write the test number (TEST N)."]);
    if (!testName || testName.length > 120) throw new ValidationError("Validation failed.", ["Write the test name."]);
    target = { kind, testName, testNumber, layout };
  }

  // The PDF goes through the ingest service's upload (staging folder + IngestSourceFile rows).
  const upstream = new FormData();
  const name = target.kind === "PRACTICE_SET" ? `Import with AI · ${target.topicName} · ${target.difficulty}` : `Import with AI · ${target.testName}`;
  upstream.set("name", name);
  upstream.set("contentType", kind);
  if (target.kind === "PRACTICE_SET") {
    upstream.set("topicName", target.topicName);
    upstream.set("domainName", target.domainName);
    upstream.set("difficulty", target.difficulty);
  }
  // No roles: the service would guess them from the names. Each file gets an upload tag instead and its
  // role is written below from the field it came in.
  uploads.forEach((u, index) => upstream.append("files", named(u.file, `F${String(index + 1).padStart(2, "0")} - ${u.file.name}`)));
  const res = await fetch(ingestUrl("/batches/upload-sources"), { method: "POST", headers: ingestAuthHeaders(), body: upstream }).catch(() => {
    throw new ServiceUnavailableError("The import service is not available. Try again in a few minutes.");
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; detail?: string };
  if (!res.ok || !data.id) throw ApiError.fromStatus(res.ok ? 502 : res.status, data.detail || "The import service could not save the files.");

  // Each saved file → its slot (by upload tag), and its role / section written from that slot.
  const saved = await prisma.ingestSourceFile.findMany({ where: { batchId: data.id }, select: { id: true, relativePath: true } });
  const files: QuickFiles = {};
  for (const row of saved) {
    const tag = (row.relativePath.split("/").pop() ?? "").match(TAG);
    const upload = tag ? uploads[Number(tag[1]) - 1] : undefined;
    if (!upload) throw ApiError.fromStatus(502, "The import service saved a file that was not uploaded.");
    files[row.id] = { slot: upload.slot, name: upload.file.name };
  }
  if (Object.keys(files).length !== uploads.length) throw ApiError.fromStatus(502, "The import service did not save every file.");
  target.files = files;
  const practiceSection = target.kind === "PRACTICE_SET" ? target.section : null;
  await prisma.$transaction([
    ...Object.entries(files).map(([id, { slot }]) => {
      const isQuestions = QUESTION_SLOTS.has(slot);
      return prisma.ingestSourceFile.update({
        where: { id },
        data: {
          isQuestionSource: isQuestions,
          isAnswerFile: !isQuestions,
          isExplanationFile: !isQuestions,
          sourceKind: isQuestions ? (kind === "PRACTICE_SET" ? "PRACTICE_EXERCISE" : "MOCK_EXAM") : "ANSWER_EXPLANATION",
          section: practiceSection ?? SECTION_OF_SLOT[slot] ?? null,
          testNumber: target.kind === "FULL_PRACTICE_TEST" ? target.testNumber ?? null : null,
        },
      });
    }),
    prisma.ingestBatch.update({
      where: { id: data.id },
      data: { importMode: QUICK_IMPORT_MODE, sourceId, targetJson: JSON.stringify(target), createdById: session.user.id },
    }),
  ]);
  // Pages for the crop tool (page count + text layer only).
  const prepared = await fetch(ingestUrl(`/batches/${data.id}/quick-prepare`), { method: "POST", headers: ingestAuthHeaders() });
  if (!prepared.ok) throw ApiError.fromStatus(prepared.status, "The PDF was saved but its pages could not be read.");

  await writeAudit({ userId: session.user.id, action: "QUICK_IMPORT_STARTED", targetType: "IngestBatch", targetId: data.id, metadata: { target, sourceId, programId } });
  return NextResponse.json({ batchId: data.id });
});
