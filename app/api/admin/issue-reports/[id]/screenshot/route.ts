import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { NotFoundError, withApiErrors } from "@/lib/api-error";

// GET /api/admin/issue-reports/[id]/screenshot — admin only (screenshots may show student data).
export const GET = withApiErrors(async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  const report = await prisma.issueReport.findUnique({ where: { id }, select: { screenshot: true, screenshotType: true } });
  if (!report?.screenshot) throw new NotFoundError("No screenshot.");
  return new Response(new Uint8Array(report.screenshot), {
    headers: { "Content-Type": report.screenshotType ?? "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
});
