import { NextResponse } from "next/server";
import { requireApprovedSession } from "@/lib/rbac";
import { getFeatureFlagSnapshot } from "@/lib/feature-flags";
import { ForbiddenError, withApiErrors } from "@/lib/api-error";

/**
 * Read-only feature flag snapshot for approved sessions.
 * Flags control product visibility — they are not an authorization mechanism.
 */
export const GET = withApiErrors(async function GET() {
  const session = await requireApprovedSession();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const snapshot = await getFeatureFlagSnapshot({
    role: session.user.role,
    userId: session.user.id,
  });

  return NextResponse.json(snapshot);
});
