import { NextRequest, NextResponse } from "next/server";
import { openQuestionImage } from "@/lib/object-storage";
import { requireApprovedSession } from "@/lib/rbac";
import { NotFoundError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

// Question images are part of the protected question bank (RNF-11/19): only signed-in, approved
// users get them, and browsers may cache them privately but no shared cache may keep them.
export const GET = withApiErrors(async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const segments = (await params).path ?? [];
  if (segments.length !== 1) {
    return new NotFoundError("Not found").toResponse();
  }
  const fileName = segments[0];
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return new NotFoundError("Not found").toResponse();
  }

  const source = await openQuestionImage(fileName);
  if (!source) {
    return new NotFoundError("Not found").toResponse();
  }

  return new NextResponse(new Uint8Array(source.data), {
    status: 200,
    headers: {
      "Content-Type": source.contentType,
      "Content-Length": String(source.data.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
});
