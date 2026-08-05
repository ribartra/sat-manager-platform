import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { encryptSecret, MISTRAL_API_KEY_SETTING, secretSummary } from "@/lib/secret-settings";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = await prisma.appSetting.findUnique({ where: { key: MISTRAL_API_KEY_SETTING } });
  return NextResponse.json(secretSummary(row?.value));
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { apiKey?: string };
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return NextResponse.json({ error: "API key is required." }, { status: 400 });
  if (apiKey.length < 20) return NextResponse.json({ error: "API key is too short." }, { status: 400 });

  const encrypted = encryptSecret(apiKey);
  await prisma.appSetting.upsert({
    where: { key: MISTRAL_API_KEY_SETTING },
    update: { value: encrypted },
    create: { key: MISTRAL_API_KEY_SETTING, value: encrypted },
  });

  const summary = secretSummary(encrypted);
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_MISTRAL_API_KEY",
      targetType: "AppSetting",
      targetId: MISTRAL_API_KEY_SETTING,
      metadata: JSON.stringify({ sha256: summary.sha256, last4: summary.last4 }),
    },
  });

  return NextResponse.json(summary);
}
