"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Setting = {
  key: string;
  label: string;
  description: string;
  value: boolean;
};

type MistralKeySummary = {
  configured: boolean;
  sha256: string | null;
  last4: string | null;
  updatedAt: string | null;
};

type SmtpSummary = {
  host: string | null;
  port: number | null;
  user: string | null;
  from: string | null;
  passwordConfigured: boolean;
  passwordLast4: string | null;
  updatedAt: string | null;
  configured: boolean;
  source: "database" | "env" | "mixed" | "none";
};

export function SettingsClient({
  settings,
  mistralKey,
  smtp,
}: {
  settings: Setting[];
  mistralKey: MistralKeySummary;
  smtp: SmtpSummary;
}) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretMessage, setSecretMessage] = useState<string | null>(null);

  const [smtpHost, setSmtpHost] = useState(smtp.host ?? "");
  const [smtpPort, setSmtpPort] = useState(smtp.port ? String(smtp.port) : "587");
  const [smtpUser, setSmtpUser] = useState(smtp.user ?? "");
  const [smtpFrom, setSmtpFrom] = useState(smtp.from ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState<string | null>(null);

  async function saveSmtp() {
    setSmtpLoading(true);
    setSmtpMessage(null);
    const response = await fetch("/api/admin/settings/smtp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        from: smtpFrom,
        password: smtpPassword,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSmtpLoading(false);
    if (!response.ok) {
      setSmtpMessage(data.error || "Could not save SMTP settings.");
      return;
    }
    setSmtpPassword("");
    setSmtpMessage(data.configured ? "SMTP settings saved. Email sending is configured." : "Saved, but some required fields are still missing.");
    router.refresh();
  }

  async function testSmtp() {
    setSmtpTesting(true);
    setSmtpMessage(null);
    const response = await fetch("/api/admin/settings/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    setSmtpTesting(false);
    if (response.ok && data.ok) {
      setSmtpMessage(`Test email sent to ${data.to}. Check the inbox.`);
      return;
    }
    if (data.reason === "SMTP_NOT_CONFIGURED") {
      setSmtpMessage("SMTP is not fully configured yet. Save host, user, sender and password first.");
      return;
    }
    setSmtpMessage(data.error || "Test email failed to send. Verify host, port and credentials.");
  }

  async function toggle(setting: Setting) {
    setLoadingKey(setting.key);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: setting.key, value: !setting.value }),
    });
    setLoadingKey(null);
    router.refresh();
  }

  async function saveMistralKey() {
    setSecretLoading(true);
    setSecretMessage(null);
    const response = await fetch("/api/admin/settings/mistral-key", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const data = await response.json().catch(() => ({}));
    setSecretLoading(false);
    if (!response.ok) {
      setSecretMessage(data.error || "Could not update Mistral key.");
      return;
    }
    setApiKey("");
    setSecretMessage(`Mistral key updated. SHA-256 ${String(data.sha256 ?? "").slice(0, 12)}...`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Integrations</h2>
        </div>
        <div className="grid gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Mistral OCR API key</p>
            <p className="mt-1 text-xs text-gray-500">
              Stored encrypted in the database. SHA-256 is kept as a fingerprint; the raw key is never shown again.
            </p>
            <div className="mt-2 grid gap-1 text-xs text-gray-500">
              <p>Status: {mistralKey.configured ? "Configured" : "Not configured"}</p>
              {mistralKey.last4 && <p>Last 4: {mistralKey.last4}</p>}
              {mistralKey.sha256 && <p className="break-all">SHA-256: {mistralKey.sha256}</p>}
              {mistralKey.updatedAt && <p suppressHydrationWarning>Updated: {new Date(mistralKey.updatedAt).toLocaleString()}</p>}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste new Mistral API key"
              autoComplete="off"
            />
            <Button type="button" onClick={saveMistralKey} disabled={secretLoading || !apiKey.trim()}>
              {secretLoading ? "Saving..." : "Save Key"}
            </Button>
          </div>
          {secretMessage && <p className="text-sm text-gray-600">{secretMessage}</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Email (SMTP)</h2>
        </div>
        <div className="grid gap-4 px-4 py-4">
          <div className="grid gap-1 text-xs text-gray-500">
            <p>
              Status:{" "}
              <span className={smtp.configured ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                {smtp.configured ? "Configured" : "Not configured"}
              </span>{" "}
              · Source: {smtp.source}
            </p>
            <p>Used for invites, parent consent, password resets and shared parent reports. Password stored encrypted; DB values override EMAIL_* env vars.</p>
            {smtp.passwordConfigured && smtp.passwordLast4 && <p suppressHydrationWarning>Password on file (last 4: {smtp.passwordLast4}){smtp.updatedAt ? ` · updated ${new Date(smtp.updatedAt).toLocaleString()}` : ""}</p>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-gray-600">
              SMTP host
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp-relay.brevo.com" autoComplete="off" />
            </label>
            <label className="grid gap-1 text-xs text-gray-600">
              Port
              <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" inputMode="numeric" autoComplete="off" />
            </label>
            <label className="grid gap-1 text-xs text-gray-600">
              SMTP user / login
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your-brevo-smtp-login" autoComplete="off" />
            </label>
            <label className="grid gap-1 text-xs text-gray-600">
              From address
              <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="noreply@yourdomain.com" autoComplete="off" />
            </label>
            <label className="grid gap-1 text-xs text-gray-600 md:col-span-2">
              Password / SMTP key {smtp.passwordConfigured && <span className="text-gray-400">(leave blank to keep current)</span>}
              <Input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder="Paste SMTP key" autoComplete="off" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveSmtp} disabled={smtpLoading}>
              {smtpLoading ? "Saving..." : "Save SMTP"}
            </Button>
            <Button type="button" variant="secondary" onClick={testSmtp} disabled={smtpTesting}>
              {smtpTesting ? "Sending..." : "Send test email"}
            </Button>
          </div>
          {smtpMessage && <p className="text-sm text-gray-600">{smtpMessage}</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Feature flags</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {settings.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between gap-4 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{setting.label}</p>
                <p className="mt-1 text-xs text-gray-500">{setting.description}</p>
                <p className="mt-1 text-xs text-gray-400">{setting.key}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(setting)}
                disabled={loadingKey === setting.key}
                className={`relative h-6 w-11 rounded-full transition ${
                  setting.value ? "bg-blue-600" : "bg-gray-300"
                } disabled:opacity-60`}
                aria-label={`Toggle ${setting.label}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    setting.value ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
