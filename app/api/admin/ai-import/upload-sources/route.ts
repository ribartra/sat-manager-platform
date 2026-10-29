import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, BadRequestError, ForbiddenError, PayloadTooLargeError, withApiErrors } from "@/lib/api-error";
import { uploadSourceId } from "@/lib/content-source";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
const ALLOWED_CONTENT_TYPES = new Set(["PRACTICE_SET", "FULL_PRACTICE_TEST"]);
const ALLOWED_ROLES = new Set(["QUESTION", "ANSWER", "EXPLANATION", "ANSWER_EXPLANATION"]);

function hasAllowedExtension(fileName: string) {
  return ALLOWED_EXTENSIONS.some((extension) => fileName.toLowerCase().endsWith(extension));
}

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return new PayloadTooLargeError("Upload exceeds the 256 MB limit.").toResponse();
  }

  const formData = await req.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);
  const roles = formData.getAll("roles").map((value) => String(value).toUpperCase());
  const contentType = String(formData.get("contentType") || "PRACTICE_SET").toUpperCase();
  const name = String(formData.get("name") || "Questionnaire PDF/DOCX ingest");

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return new BadRequestError("Choose Practice Set or Test import.").toResponse();
  }
  if (files.length === 0) {
    return new BadRequestError("Select at least one PDF or DOCX file.").toResponse();
  }
  if (roles.length > 0 && roles.length !== files.length) {
    return new BadRequestError("Each uploaded file needs a role (Questions or Answers/Explanations).").toResponse();
  }
  if (roles.some((role) => !ALLOWED_ROLES.has(role))) {
    return new BadRequestError("Invalid file role.").toResponse();
  }
  // The Questions file is the required tray; answers/explanations alone cannot make a batch.
  if (roles.length > 0 && !roles.includes("QUESTION")) {
    return new BadRequestError("Add the Questions file (PDF or DOCX) to create the batch.").toResponse();
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_UPLOAD_BYTES) {
    return new PayloadTooLargeError("Upload exceeds the 256 MB limit.").toResponse();
  }
  const unsupported = files.find((file) => !hasAllowedExtension(file.name));
  if (unsupported) {
    return new BadRequestError(`Unsupported file type: ${unsupported.name}. Use PDF or DOCX.`).toResponse();
  }

  const source = await uploadSourceId(formData.get("sourceId"));
  if (source.error) return new BadRequestError(source.error).toResponse();

  const upstream = new FormData();
  upstream.set("name", name);
  upstream.set("contentType", contentType);
  for (const key of ["difficulty", "topicName", "domainName", "testNumber"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value.trim()) upstream.set(key, value.trim());
  }
  for (const file of files) upstream.append("files", file, file.name);
  for (const role of roles) upstream.append("roles", role);

  const res = await fetch(ingestUrl("/batches/upload-sources"), {
    method: "POST",
    headers: ingestAuthHeaders(),
    body: upstream,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return ApiError.fromStatus(res.status, data.detail || "Ingest service failed while uploading sources.").toResponse();
  }

  // Content source of what this batch will promote (AI Import "Source" field).
  if (source.sourceId && data.id) await prisma.ingestBatch.update({ where: { id: data.id }, data: { sourceId: source.sourceId, createdById: session.user.id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPLOAD_AI_IMPORT_SOURCES",
      targetType: "IngestBatch",
      targetId: data.id,
      metadata: JSON.stringify({
        contentType,
        name,
        fileCount: files.length,
        roles,
        totalSize,
        sourceId: source.sourceId,
        source: "QUESTIONNAIRE_EDITOR",
      }),
    },
  });

  return NextResponse.json(data);
});
