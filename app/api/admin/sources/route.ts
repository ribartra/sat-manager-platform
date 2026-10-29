import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { ConflictError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";

// GET /api/admin/sources — every source with how many Practice Sets and Tests use it.
export const GET = withApiErrors(async function GET() {
  await assertAdmin();
  const sources = await prisma.source.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, _count: { select: { practiceSets: true, fullPracticeTests: true } } },
  });
  return NextResponse.json({ sources });
});

// POST /api/admin/sources — { name } adds a source at the end of the list.
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await assertAdmin();
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) throw new ValidationError("Validation failed.", ["Write a source name (up to 80 characters)."]);
  if (await prisma.source.findFirst({ where: { name } })) throw new ConflictError(`A source named "${name}" already exists.`);
  const last = await prisma.source.aggregate({ _max: { sortOrder: true } });
  const source = await prisma.source.create({ data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  await writeAudit({ userId: session.user.id, action: "SOURCE_CREATED", targetType: "Source", targetId: source.id, metadata: { name } });
  return NextResponse.json({ source });
});
