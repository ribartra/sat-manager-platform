import { NextRequest, NextResponse } from "next/server";
import { openQuestionImage } from "@/lib/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
