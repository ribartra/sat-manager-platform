import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { anonymizeUser } from "@/lib/privacy";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Erasure on request (RNF-12): personal data is removed, academic history stays (anonymous).
// The admin must type the account's current email to confirm; it cannot be undone.
//   POST /api/admin/users/[userId]/anonymize  { confirmEmail }
export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot anonymize your own account." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { confirmEmail?: unknown };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (typeof body.confirmEmail !== "string" || body.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Type the account's email to confirm." }, { status: 400 });
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
}
