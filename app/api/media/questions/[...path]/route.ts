import { NextRequest, NextResponse } from "next/server";
import { openQuestionImage } from "@/lib/object-storage";
import { requireApprovedSession } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

// Question images are part of the protected question bank (RNF-11/19): only signed-in, approved
// users get them, and browsers may cache them privately but no shared cache may keep them.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const segments = (await params).path ?? [];
  if (segments.length !== 1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const fileName = segments[0];
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const source = await openQuestionImage(fileName);
  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(source.data), {
    status: 200,
    headers: {
      "Content-Type": source.contentType,
      "Content-Length": String(source.data.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
