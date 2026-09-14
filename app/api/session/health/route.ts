import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const user = await withSqliteRetry(() => prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true },
  }));

  if (!user?.active) {
    return NextResponse.json({ ok: false, reason: "inactive" }, { status: 401 });
  }
  if (user.validationStatus !== "APPROVED") {
    return NextResponse.json({ ok: false, reason: "rejected" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
