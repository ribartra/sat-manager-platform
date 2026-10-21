import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { writeAudit } from "@/lib/audit";
import { BadRequestError, withApiErrors } from "@/lib/api-error";
import { inviteUnusableReason, TERMS_VERSION } from "@/lib/consent";

export const GET = withApiErrors(async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new BadRequestError("This invitation link is incomplete. Please use the full link from the email.").toResponse();
  const limited = checkRateLimit(rateLimitKey(req, "invite-info", token.slice(0, 12)), 20, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  const tokenHash = hashPublicToken(token);
  const invite = await prisma.inviteToken.findFirst({
    where: { OR: [{ tokenHash }, { token }] },
    include: { program: true },
  });
  const unusable = inviteUnusableReason(invite);
  if (!invite || unusable) {
    await writeAudit({
      action: "INVITE_VIEW_FAILED",
      targetType: "InviteToken",
      targetId: invite?.id ?? token.slice(0, 12),
      outcome: "failure",
      metadata: { reason: unusable, tokenPrefix: token.slice(0, 8) },
    });
    return new BadRequestError("This invitation link doesn't work or has expired. Ask your teacher for a new one.").toResponse();
  }
  if (!invite.tokenHash) {
    await prisma.inviteToken.update({ where: { id: invite.id }, data: { tokenHash, token: `hashed:${tokenHash}` } });
  }

  await writeAudit({
    action: "INVITE_VIEWED",
    targetType: "InviteToken",
    targetId: invite.id,
    outcome: "success",
    metadata: { email: invite.email, role: invite.role, isMinor: invite.isMinor },
  });

  return NextResponse.json({
    role: invite.role,
    name: invite.name,
    email: invite.email,
    phone: invite.phone,
    startDate: invite.startDate?.toISOString().slice(0, 10) ?? null,
    programName: invite.program?.name ?? null,
    // Under 18: the activation page shows the minors clause of the Terms next to the checkbox.
    isMinor: invite.isMinor,
    termsVersion: TERMS_VERSION,
  });
});
