import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { ConflictError, NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/sources/[id] — { name?, active?, forPracticeSets?, forTests?, sortOrder? }: rename, activate /
// deactivate, or choose which content it is offered for. Sources are never
// deleted (their sets and Tests keep them); an inactive source leaves the editors.
export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await assertAdmin();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { name?: unknown; active?: unknown; forPracticeSets?: unknown; forTests?: unknown; sortOrder?: unknown } | null;
  const previous = await prisma.source.findUnique({ where: { id }, select: { name: true, active: true, forPracticeSets: true, forTests: true } });
  if (!previous) throw new NotFoundError("Source not found.");

  const data: { name?: string; active?: boolean; forPracticeSets?: boolean; forTests?: boolean; sortOrder?: number } = {};
  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) throw new ValidationError("Validation failed.", ["Write a source name (up to 80 characters)."]);
    if (name !== previous.name && (await prisma.source.findFirst({ where: { name, id: { not: id } } }))) {
      throw new ConflictError(`A source named "${name}" already exists.`);
    }
    data.name = name;
  }
  if (body?.active !== undefined) {
    if (typeof body.active !== "boolean") throw new ValidationError("Validation failed.", ["active must be true or false."]);
    data.active = body.active;
  }
  if (body?.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) throw new ValidationError("Validation failed.", ["sortOrder must be a whole number."]);
    data.sortOrder = body.sortOrder as number;
  }
  for (const key of ["forPracticeSets", "forTests"] as const) {
    if (body?.[key] === undefined) continue;
    if (typeof body[key] !== "boolean") throw new ValidationError("Validation failed.", [`${key} must be true or false.`]);
    data[key] = body[key];
  }
  if (Object.keys(data).length === 0) throw new ValidationError("Validation failed.", ["Nothing to change."]);

  const source = await prisma.source.update({ where: { id }, data });
  await writeAudit({ userId: session.user.id, action: "SOURCE_UPDATED", targetType: "Source", targetId: id, metadata: { previous, ...data } });
  return NextResponse.json({ source });
});
