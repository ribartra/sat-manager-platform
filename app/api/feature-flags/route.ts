import { NextResponse } from "next/server";
import { requireApprovedSession } from "@/lib/rbac";
import { getFeatureFlagSnapshot } from "@/lib/feature-flags";

/**
 * Read-only feature flag snapshot for approved sessions.
 * Flags control product visibility — they are not an authorization mechanism.
 */
export async function GET() {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const snapshot = await getFeatureFlagSnapshot({
    role: session.user.role,
    userId: session.user.id,
  });

  return NextResponse.json(snapshot);
}
