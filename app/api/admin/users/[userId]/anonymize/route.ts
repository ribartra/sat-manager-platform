import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { anonymizeUser } from "@/lib/privacy";
import { writeAudit } from "@/lib/audit";
import { BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

export const runtime = "nodejs";

// Erasure on request (RNF-12): personal data is removed, academic history stays (anonymous).
// The admin must type the account's current email to confirm; it cannot be undone.
//   POST /api/admin/users/[userId]/anonymize  { confirmEmail }
export const POST = withApiErrors(async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { userId } = await params;
  if (userId === session.user.id) {
    return new BadRequestError("You cannot anonymize your own account.").toResponse();
  }
  const body = (await req.json().catch(() => ({}))) as { confirmEmail?: unknown };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!user) return new NotFoundError("Not found").toResponse();
  if (typeof body.confirmEmail !== "string" || body.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return new BadRequestError("Type the account's email to confirm.").toResponse();
  }

  await anonymizeUser(userId);
  await writeAudit({
    userId: session.user.id,
    action: "USER_ANONYMIZED",
    targetType: "User",
    targetId: userId,
    outcome: "success",
    metadata: { role: user.role },
  });

  return NextResponse.json({ ok: true });
});
