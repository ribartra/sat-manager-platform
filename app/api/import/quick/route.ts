import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertContentImporter } from "@/lib/rbac";
import { contentProgramFor } from "@/lib/program-scope";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, BadRequestError, PayloadTooLargeError, ValidationError, withApiErrors } from "@/lib/api-error";
import { sourceIdIssue } from "@/lib/content-source";
import { resolvePracticeArea } from "@/lib/practice-area";
import { isOfficialSkill } from "@/lib/taxonomy-order";
import { writeAudit } from "@/lib/audit";
import { QUICK_IMPORT_MODE, type QuickImportTarget } from "@/lib/quick-import";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const LEVELS = new Set(["EASY", "MEDIUM", "HARD"]);

// POST /api/import/quick — "Import with AI", step 1: the target (Practice Set: skill + level; Test:
// name) + source + the original PDF (kept for cropping and the artifacts zip; no OCR is run).
// Form: kind, topicId?, difficulty?, testName?, sourceId, file (PDF), answers? (PDF, optional).
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await assertContentImporter();
  const programId = await contentProgramFor(session.user);
  const form = await req.formData();
  const kind = String(form.get("kind") || "PRACTICE_SET").toUpperCase();
  const sourceId = String(form.get("sourceId") || "");
  const file = form.get("file");
  const answers = form.get("answers");

  if (kind !== "PRACTICE_SET" && kind !== "FULL_PRACTICE_TEST") throw new BadRequestError("Choose Practice Set or Test.");
  const sourceIssue = await sourceIdIssue(sourceId, kind === "PRACTICE_SET" ? "practice" : "tests");
  if (sourceIssue) throw new ValidationError("Validation failed.", [sourceIssue]);
  const pdfs = [file, answers].filter((value): value is File => value instanceof File && value.size > 0);
  if (!(file instanceof File) || file.size === 0) throw new ValidationError("Validation failed.", ["Upload the questions PDF."]);
  if (pdfs.some((pdf) => !pdf.name.toLowerCase().endsWith(".pdf"))) throw new ValidationError("Validation failed.", ["Upload PDF files."]);
  if (pdfs.reduce((sum, pdf) => sum + pdf.size, 0) > MAX_UPLOAD_BYTES) throw new PayloadTooLargeError("Upload exceeds the 256 MB limit.");

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
    target = { kind, testName, testNumber };
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
  upstream.append("files", file, file.name);
  upstream.append("roles", "QUESTION");
  if (answers instanceof File && answers.size > 0) {
    upstream.append("files", answers, answers.name);
    upstream.append("roles", "ANSWER_EXPLANATION");
  }
  const res = await fetch(ingestUrl("/batches/upload-sources"), { method: "POST", headers: ingestAuthHeaders(), body: upstream });
  const data = (await res.json().catch(() => ({}))) as { id?: string; detail?: string };
  if (!res.ok || !data.id) throw ApiError.fromStatus(res.ok ? 502 : res.status, data.detail || "The import service could not save the PDF.");

  await prisma.ingestBatch.update({
    where: { id: data.id },
    data: { importMode: QUICK_IMPORT_MODE, sourceId, targetJson: JSON.stringify(target), createdById: session.user.id },
  });
  // Pages for the crop tool (page count + text layer only).
  const prepared = await fetch(ingestUrl(`/batches/${data.id}/quick-prepare`), { method: "POST", headers: ingestAuthHeaders() });
  if (!prepared.ok) throw ApiError.fromStatus(prepared.status, "The PDF was saved but its pages could not be read.");

  await writeAudit({ userId: session.user.id, action: "QUICK_IMPORT_STARTED", targetType: "IngestBatch", targetId: data.id, metadata: { target, sourceId, programId } });
  return NextResponse.json({ batchId: data.id });
});
