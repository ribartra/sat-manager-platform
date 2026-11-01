import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

/**
 * Domain ↔ Skill correspondence aliases (TaxonomyAlias). An alias is another name a domain or skill
 * is printed with (e.g. "Grammar" for Form, Structure & Sense); the platform keeps showing the
 * reference name and uses aliases to match ingest files.
 */
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const body = (await req.json()) as { alias?: unknown; domainId?: unknown; topicId?: unknown };
  const alias = typeof body.alias === "string" ? body.alias.trim().replace(/\s+/g, " ") : "";
  const domainId = typeof body.domainId === "string" ? body.domainId : "";
  const topicId = typeof body.topicId === "string" && body.topicId ? body.topicId : null;
  if (!alias || alias.length > 120 || !domainId) throw new BadRequestError("Write the alias (up to 120 characters).");

  const kind = topicId ? "SKILL" : "DOMAIN";
  if (topicId) {
    const topic = await prisma.topic.findFirst({ where: { id: topicId, domainId }, select: { name: true } });
    if (!topic) throw new NotFoundError("Skill not found in this domain.");
    if (topic.name.toLowerCase() === alias.toLowerCase()) throw new BadRequestError("The alias is the skill's own name.");
  } else {
    const domain = await prisma.domain.findUnique({ where: { id: domainId }, select: { name: true } });
    if (!domain) throw new NotFoundError("Domain not found.");
    if (domain.name.toLowerCase() === alias.toLowerCase()) throw new BadRequestError("The alias is the domain's own name.");
  }
  const taken = await prisma.taxonomyAlias.findFirst({ where: { kind, alias }, select: { id: true } });
  if (taken) throw new ConflictError(`"${alias}" is already an alias of another ${kind === "SKILL" ? "skill" : "domain"}.`);

  const created = await prisma.taxonomyAlias.create({ data: { alias, kind, domainId, topicId, source: "MANUAL" } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_TAXONOMY_ALIAS",
      targetType: "TaxonomyAlias",
      targetId: created.id,
      metadata: JSON.stringify({ alias, kind, domainId, topicId }),
    },
  });
  return NextResponse.json({ alias: created }, { status: 201 });
});
