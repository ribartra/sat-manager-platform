import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { objectStorage } from "@/lib/object-storage";
import { requireApprovedSession } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type RouteContext = { params: Promise<{ file: string }> };

// Profile pictures are personal data (RNF-12): served only to signed-in users, never publicly cached.
// /uploads/avatars/<file> is rewritten here before Next's static public/ handling (next.config.ts).
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { file } = await params;
  const safe = path.basename(file ?? "");
  const contentType = CONTENT_TYPES[path.extname(safe).toLowerCase()];
  if (!safe || safe !== file || !contentType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await objectStorage.get(`uploads/avatars/${safe}`);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
