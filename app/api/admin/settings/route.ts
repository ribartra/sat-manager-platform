import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { FEATURE_SETTINGS, getFeatureSettings, isFeatureSettingKey } from "@/lib/app-settings";
import { requireAdmin } from "@/lib/rbac";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const values = await getFeatureSettings();
  return NextResponse.json({
    settings: Object.entries(FEATURE_SETTINGS).map(([key, config]) => ({
      key,
      label: config.label,
      description: config.description,
      value: values[key as keyof typeof FEATURE_SETTINGS],
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const key = typeof body.key === "string" ? body.key : "";
  if (!isFeatureSettingKey(key)) {
    return NextResponse.json({ error: "Unknown setting." }, { status: 400 });
  }

  const value = body.value === true ? "true" : "false";
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_APP_SETTING",
      targetType: "AppSetting",
      targetId: key,
      metadata: JSON.stringify({ value }),
    },
  });

  return NextResponse.json({ key, value: value === "true" });
}

