import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { requiresParentAuthorization } from "@/lib/consent";
import { sendParentAuthorizationLink } from "@/lib/parent-authorization";
import { BadRequestError, ServiceUnavailableError, withApiErrors } from "@/lib/api-error";

// Student (not signed in yet) asks to resend the authorization email to their parent.
// Authenticated by the student's own invitation token; only the parent email on the invite is used.
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: null }));
  if (!token || typeof token !== "string") {
    return new BadRequestError("This invitation link is incomplete. Please use the full link from the email.").toResponse();
  }
  const limited = checkRateLimit(rateLimitKey(req, "parent-consent-resend", token.slice(0, 12)), 3, 60 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  const tokenHash = hashPublicToken(token);
  const invite = await prisma.inviteToken.findFirst({ where: { OR: [{ tokenHash }, { token }] } });
  if (!invite || invite.role !== "STUDENT" || invite.usedAt || invite.expiresAt < new Date()) {
    return new BadRequestError("This invitation link doesn't work or has expired. Ask your teacher for a new one.").toResponse();
  }
  if (!requiresParentAuthorization(invite)) {
    return new BadRequestError("Your parent or guardian has already authorized your account. You can finish setting up.").toResponse();
  }

  const result = await sendParentAuthorizationLink(invite.id, { reason: "student_resend" });
  if (!result.sent) {
    return new ServiceUnavailableError("We couldn't send the email right now. Please ask your teacher for help.").toResponse();
  }
  return NextResponse.json({ ok: true, parentEmail: invite.parentEmail });
});
