import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, BadRequestError, ForbiddenError, PayloadTooLargeError, withApiErrors } from "@/lib/api-error";
import { uploadSourceId } from "@/lib/content-source";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return new PayloadTooLargeError("ZIP upload exceeds the 256 MB limit.").toResponse();
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const name = String(formData.get("name") || "AI ZIP content ingest");

  if (!(file instanceof File)) {
    return new BadRequestError("Select a ZIP file to upload.").toResponse();
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return new BadRequestError("Only .zip uploads are supported.").toResponse();
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return new PayloadTooLargeError("ZIP upload exceeds the 256 MB limit.").toResponse();
  }

  const source = await uploadSourceId(formData.get("sourceId"));
  if (source.error) return new BadRequestError(source.error).toResponse();

  const upstream = new FormData();
  upstream.set("name", name);
  upstream.set("file", file, file.name);

  const res = await fetch(ingestUrl("/batches/upload-zip"), {
    method: "POST",
    headers: ingestAuthHeaders(),
    body: upstream,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return ApiError.fromStatus(res.status, data.detail || "Ingest service failed while uploading ZIP.").toResponse();
  }

  // Content source of what this batch will promote (AI Import "Source" field).
  if (source.sourceId && data.id) await prisma.ingestBatch.update({ where: { id: data.id }, data: { sourceId: source.sourceId, createdById: session.user.id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPLOAD_AI_IMPORT_ZIP",
      targetType: "IngestBatch",
      targetId: data.id,
      metadata: JSON.stringify({ ...data, fileName: file.name, fileSize: file.size, sourceId: source.sourceId }),
    },
  });

  return NextResponse.json(data);
});
