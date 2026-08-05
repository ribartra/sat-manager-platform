import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
const ALLOWED_CONTENT_TYPES = new Set(["PRACTICE_SET", "FULL_PRACTICE_TEST"]);

function hasAllowedExtension(fileName: string) {
  return ALLOWED_EXTENSIONS.some((extension) => fileName.toLowerCase().endsWith(extension));
}

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "Upload exceeds the 256 MB limit." }, { status: 413 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);
  const contentType = String(formData.get("contentType") || "PRACTICE_SET").toUpperCase();
  const name = String(formData.get("name") || "Questionnaire PDF/DOCX ingest");

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Choose Practice Set or Full Practice Test import." }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "Select at least one PDF or DOCX file." }, { status: 400 });
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Upload exceeds the 256 MB limit." }, { status: 413 });
  }
  const unsupported = files.find((file) => !hasAllowedExtension(file.name));
  if (unsupported) {
    return NextResponse.json({ error: `Unsupported file type: ${unsupported.name}. Use PDF or DOCX.` }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.set("name", name);
  upstream.set("contentType", contentType);
  for (const key of ["difficulty", "topicName", "domainName", "testNumber"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value.trim()) upstream.set(key, value.trim());
  }
  for (const file of files) upstream.append("files", file, file.name);

  const res = await fetch(ingestUrl("/batches/upload-sources"), {
    method: "POST",
    headers: ingestAuthHeaders(),
    body: upstream,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data.detail || "Ingest service failed while uploading sources." }, { status: res.status });
  }

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
        totalSize,
        source: "QUESTIONNAIRE_EDITOR",
      }),
    },
  });

  return NextResponse.json(data);
}
