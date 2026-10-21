import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { BadRequestError, withApiErrors } from "@/lib/api-error";
import { getCoderAgentSummary, normalizeAgentUrl, rotateCallbackToken, saveCoderAgentConfig } from "@/lib/coder-agent-settings";

// Admin → Settings → Coding agent. The outbound token is stored with encryptSecret; the callback token
// is generated here, returned once, and only its hash is kept (lib/coder-agent-settings.ts).
export const GET = withApiErrors(async function GET() {
  await assertAdmin();
  return NextResponse.json(await getCoderAgentSummary());
});

export const PUT = withApiErrors(async function PUT(req: NextRequest) {
  const session = await assertAdmin();
  const body = (await req.json().catch(() => ({}))) as { url?: string; token?: string };
  const url = normalizeAgentUrl(typeof body.url === "string" ? body.url : "");
  if (url === null) throw new BadRequestError("The agent URL must start with https:// (or be empty to turn it off).");
  await saveCoderAgentConfig({ url, token: typeof body.token === "string" ? body.token : undefined });
  await writeAudit({
    userId: session.user.id,
    action: "CODER_AGENT_SETTINGS_UPDATED",
    targetType: "AppSetting",
    targetId: "CODER_AGENT",
    metadata: { url: url || null, tokenChanged: Boolean(body.token?.trim()) },
  });
  return NextResponse.json(await getCoderAgentSummary());
});

// POST { action: "rotate-callback-token" } → { token } (shown once).
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await assertAdmin();
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "rotate-callback-token") throw new BadRequestError("Unknown action.");
  const token = await rotateCallbackToken();
  await writeAudit({ userId: session.user.id, action: "CODER_AGENT_CALLBACK_TOKEN_ROTATED", targetType: "AppSetting", targetId: "CODER_AGENT" });
  return NextResponse.json({ token, summary: await getCoderAgentSummary() });
});
