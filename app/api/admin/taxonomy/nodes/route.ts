import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

const NODE_TYPES = new Set(["AREA", "DOMAIN", "SKILL", "SUBSKILL"]);

async function ancestorOfType(parentId: string | null, type: string) {
  let currentId = parentId;
  for (let depth = 0; currentId && depth < 10; depth += 1) {
    const node = await prisma.taxonomyNode.findUnique({ where: { id: currentId } });
    if (!node) return null;
    if (node.type === type) return node;
    currentId = node.parentId;
  }
  return null;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const nodes = await prisma.taxonomyNode.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ nodes });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : name;
  const type = typeof body.type === "string" ? body.type.trim().toUpperCase() : "";
  const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!name || !NODE_TYPES.has(type)) return NextResponse.json({ error: "Name and valid type are required." }, { status: 400 });

  const node = await prisma.taxonomyNode.create({
    data: { name, label, type, parentId, sortOrder, active: true },
  });
  if (type === "SKILL") {
    const domainAncestor = await ancestorOfType(parentId, "DOMAIN");
    const legacyDomainId = domainAncestor?.id.match(/^tax-(?:topic|domain)-/)
      ? domainAncestor.id.replace(/^tax-(?:topic|domain)-/, "")
      : null;
    if (legacyDomainId) {
      await prisma.topic.create({
        data: { name: label, domainId: legacyDomainId, taxonomyNodeId: node.id },
      });
    }
  }
  if (type === "SUBSKILL") {
    const skillAncestor = await ancestorOfType(parentId, "SKILL");
    const legacyTopic = skillAncestor
      ? await prisma.topic.findFirst({ where: { taxonomyNodeId: skillAncestor.id }, select: { id: true } })
      : null;
    if (legacyTopic) {
      await prisma.subskill.create({
        data: { name: label, topicId: legacyTopic.id, taxonomyNodeId: node.id },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_TAXONOMY_NODE",
      targetType: "TaxonomyNode",
      targetId: node.id,
      metadata: JSON.stringify({ name, label, type, parentId, sortOrder }),
    },
  });

  return NextResponse.json({ node });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Node id is required." }, { status: 400 });

  const data: { name?: string; label?: string; parentId?: string | null; sortOrder?: number; active?: boolean } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (body.parentId !== undefined) data.parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder);
  if (body.active !== undefined) data.active = body.active === true;

  const node = await prisma.taxonomyNode.update({ where: { id }, data });
  if (data.name || data.label || data.active !== undefined) {
    const legacyName = data.label ?? data.name;
    if (legacyName && node.type === "SKILL") {
      await prisma.topic.updateMany({ where: { taxonomyNodeId: node.id }, data: { name: legacyName } });
    }
    if (legacyName && node.type === "SUBSKILL") {
      await prisma.subskill.updateMany({ where: { taxonomyNodeId: node.id }, data: { name: legacyName } });
    }
  }
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_TAXONOMY_NODE",
      targetType: "TaxonomyNode",
      targetId: id,
      metadata: JSON.stringify(data),
    },
  });

  return NextResponse.json({ node });
}
