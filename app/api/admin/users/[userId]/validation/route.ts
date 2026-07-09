import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { notify } from "@/lib/notify";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const { validationStatus } = await req.json();
  if (typeof validationStatus !== "string" || !VALID_STATUSES.has(validationStatus)) {
    return NextResponse.json({ error: "Invalid validation status" }, { status: 400 });
  }

  if (userId === session.user.id && validationStatus !== "APPROVED") {
    return NextResponse.json({ error: "Administrators cannot revoke their own validation." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const reviewed = validationStatus !== "PENDING";
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      validationStatus,
      validationReviewedAt: reviewed ? new Date() : null,
      validationReviewedById: reviewed ? session.user.id : null,
    },
    select: { id: true, validationStatus: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: `ACCOUNT_VALIDATION_${validationStatus}`,
      targetType: "User",
      targetId: userId,
    },
  });

  if (validationStatus === "APPROVED") {
    await notify(userId, {
      title: "Account approved",
      body: "Your account has been approved. You can now access the platform.",
      href: "/login",
    }).catch(() => {});
  } else if (validationStatus === "REJECTED") {
    await notify(userId, {
      title: "Account not approved",
      body: "Your account registration could not be approved. Contact support if you have questions.",
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
