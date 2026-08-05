import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";

interface RouteContext {
  params: Promise<{ batchId: string; fileName: string }>;
}

const PRIVATE_INGEST_UPLOAD_ROOT = process.env.INGEST_PUBLIC_UPLOAD_ROOT ?? path.join(process.cwd(), ".private", "uploads", "ingest");
const SAFE_BATCH = /^batch_[a-f0-9]+$/i;
const SAFE_FILE = /^img_[a-f0-9]+-[a-f0-9]+\.(jpg|jpeg|png|webp)$/i;

function contentTypeFor(fileName: string) {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { batchId, fileName } = await params;
  if (!SAFE_BATCH.test(batchId) || !SAFE_FILE.test(fileName)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const root = path.resolve(PRIVATE_INGEST_UPLOAD_ROOT);
  const filePath = path.resolve(root, batchId, fileName);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeFor(fileName),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
