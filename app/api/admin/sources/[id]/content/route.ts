import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const ids = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : []);

// POST /api/admin/sources/[id]/content — { practiceSetIds?, testIds? }: associate those Practice Sets /
// Tests with this source (source master). Practice Sets need a source used for Practice Sets, Tests one
// used for Tests. Admin only (every program's content).
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: Ctx) {
  const session = await assertAdmin();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { practiceSetIds?: unknown; testIds?: unknown } | null;
  const practiceSetIds = ids(body?.practiceSetIds);
  const testIds = ids(body?.testIds);
  if (!practiceSetIds.length && !testIds.length) throw new ValidationError("Validation failed.", ["Choose at least one Practice Set or Test."]);

  const source = await prisma.source.findUnique({ where: { id }, select: { name: true, forPracticeSets: true, forTests: true } });
  if (!source) throw new NotFoundError("Source not found.");
  const errors = [
    practiceSetIds.length && !source.forPracticeSets ? `"${source.name}" is not used for Practice Sets.` : null,
    testIds.length && !source.forTests ? `"${source.name}" is not used for Tests.` : null,
  ].filter((e): e is string => Boolean(e));
  if (errors.length) throw new ValidationError("Validation failed.", errors);

  // Previous sources, for the audit trail.
  const [previousSets, previousTests] = await Promise.all([
    prisma.practiceSet.findMany({ where: { id: { in: practiceSetIds } }, select: { id: true, sourceId: true } }),
    prisma.fullPracticeTest.findMany({ where: { id: { in: testIds } }, select: { id: true, sourceId: true } }),
  ]);
  const [sets, tests] = await prisma.$transaction([
    prisma.practiceSet.updateMany({ where: { id: { in: practiceSetIds } }, data: { sourceId: id } }),
    prisma.fullPracticeTest.updateMany({ where: { id: { in: testIds } }, data: { sourceId: id } }),
  ]);
  await writeAudit({
    userId: session.user.id,
    action: "SOURCE_CONTENT_ASSIGNED",
    targetType: "Source",
    targetId: id,
    metadata: { practiceSets: previousSets, tests: previousTests },
  });
  return NextResponse.json({ practiceSets: sets.count, tests: tests.count });
});
