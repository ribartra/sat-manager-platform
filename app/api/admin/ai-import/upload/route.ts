import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "ZIP upload exceeds the 256 MB limit." }, { status: 413 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const name = String(formData.get("name") || "AI ZIP content ingest");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Select a ZIP file to upload." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Only .zip uploads are supported." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "ZIP upload exceeds the 256 MB limit." }, { status: 413 });
  }

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
    return NextResponse.json({ error: data.detail || "Ingest service failed while uploading ZIP." }, { status: res.status });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPLOAD_AI_IMPORT_ZIP",
      targetType: "IngestBatch",
      targetId: data.id,
      metadata: JSON.stringify({ ...data, fileName: file.name, fileSize: file.size }),
    },
  });

  return NextResponse.json(data);
}
