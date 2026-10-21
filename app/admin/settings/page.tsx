import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import { redirect } from "next/navigation";
import { FEATURE_SETTINGS, getFeatureSettings } from "@/lib/app-settings";
import { requireAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { MISTRAL_API_KEY_SETTING, secretSummary } from "@/lib/secret-settings";
import { getSmtpSummary } from "@/lib/smtp-settings";
import { getCoderAgentSummary } from "@/lib/coder-agent-settings";
import { absoluteAppUrl } from "@/lib/email";
import { CoderAgentCard } from "./coder-agent-card";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/teacher");

  const [values, mistralSetting, smtp, coderAgent] = await Promise.all([
    getFeatureSettings(),
    prisma.appSetting.findUnique({ where: { key: MISTRAL_API_KEY_SETTING } }),
    getSmtpSummary(),
    getCoderAgentSummary(),
  ]);
  const settings = Object.entries(FEATURE_SETTINGS).map(([key, config]) => ({
    key,
    label: config.label,
    description: config.description,
    owner: config.owner,
    expiresAt: config.expiresAt,
    value: values[key as keyof typeof FEATURE_SETTINGS],
  }));

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Settings" }]} />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Platform Settings</h1>
      <p className="mb-6 text-sm text-gray-500">
        Turn optional features on or off.
      </p>
      <SettingsClient settings={settings} mistralKey={secretSummary(mistralSetting?.value)} smtp={smtp} />
      <div className="mt-6">
        <CoderAgentCard summary={coderAgent} callbackBase={absoluteAppUrl("/api/agent/issue-reports")} />
      </div>
    </PageShell>
  );
}
