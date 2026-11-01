import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

export const DELETE = withApiErrors(async function DELETE(_req: NextRequest, { params }: { params: Promise<{ aliasId: string }> }) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { aliasId } = await params;
  const alias = await prisma.taxonomyAlias.findUnique({ where: { id: aliasId } });
  if (!alias) throw new NotFoundError("Alias not found.");
  await prisma.taxonomyAlias.delete({ where: { id: aliasId } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_TAXONOMY_ALIAS",
      targetType: "TaxonomyAlias",
      targetId: aliasId,
      metadata: JSON.stringify({ alias: alias.alias, kind: alias.kind, domainId: alias.domainId, topicId: alias.topicId, source: alias.source }),
    },
  });
  return NextResponse.json({ ok: true });
});
