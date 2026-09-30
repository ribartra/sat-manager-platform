import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { exportUserData } from "@/lib/privacy";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Data export on request (RNF-12): every record the platform keeps about the account, as JSON.
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const data = await exportUserData(userId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeAudit({
    userId: session.user.id,
    action: "USER_DATA_EXPORTED",
    targetType: "User",
    targetId: userId,
    outcome: "success",
  });

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="user-export-${userId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
