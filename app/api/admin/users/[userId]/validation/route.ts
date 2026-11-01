import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import { BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { userId } = await params;
  const { validationStatus } = await req.json();
  if (typeof validationStatus !== "string" || !VALID_STATUSES.has(validationStatus)) {
    return new BadRequestError("Invalid validation status").toResponse();
  }

  if (userId === session.user.id && validationStatus !== "APPROVED") {
    return new BadRequestError("Administrators cannot revoke their own validation.").toResponse();
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!target) return new NotFoundError("User not found").toResponse();

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
});
