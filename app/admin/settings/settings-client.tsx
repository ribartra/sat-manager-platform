"use client";

import { BLOCKED_SWITCH } from "@/components/ui/control-states";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection } from "@/components/sat";
import {
  mistralKeySchema,
  smtpSettingsSchema,
  type MistralKeyInput,
  type SmtpSettingsInput,
} from "@/contracts/admin";
import { errorMessage, readApiError } from "@/lib/api-client";

type Setting = {
  key: string;
  label: string;
  description: string;
  owner?: string;
  expiresAt?: string | null;
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
  const [secretMessage, setSecretMessage] = useState<string | null>(null);
  const [smtpMessage, setSmtpMessage] = useState<string | null>(null);
  const [smtpTesting, setSmtpTesting] = useState(false);

  const mistralForm = useForm<MistralKeyInput>({
    resolver: zodResolver(mistralKeySchema),
    defaultValues: { apiKey: "" },
  });

  const smtpForm = useForm<SmtpSettingsInput>({
    resolver: zodResolver(smtpSettingsSchema),
    defaultValues: {
      host: smtp.host ?? "",
      port: smtp.port ? String(smtp.port) : "587",
      user: smtp.user ?? "",
      from: smtp.from ?? "",
      password: "",
    },
  });

  async function onSaveMistral(values: MistralKeyInput) {
    setSecretMessage(null);
    const response = await fetch("/api/admin/settings/mistral-key", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: values.apiKey }),
    });
    if (!response.ok) {
      setSecretMessage(errorMessage(await readApiError(response, "Could not save the key.")));
      return;
    }
    mistralForm.reset({ apiKey: "" });
    setSecretMessage("Key saved.");
    router.refresh();
  }

  async function onSaveSmtp(values: SmtpSettingsInput) {
    setSmtpMessage(null);
    const response = await fetch("/api/admin/settings/smtp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: values.host,
        port: values.port,
        user: values.user,
        from: values.from,
        password: values.password ?? "",
      }),
    });
    if (!response.ok) {
      setSmtpMessage(errorMessage(await readApiError(response, "Could not save the email settings.")));
      return;
    }
    const data = await response.json();
    smtpForm.setValue("password", "");
    setSmtpMessage(
      data.configured
        ? "Saved. Email sending is set up."
        : "Saved, but some required fields are still missing.",
    );
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
    setSmtpTesting(false);
    // A failed send may still carry a structured reason (e.g. SMTP_NOT_CONFIGURED).
    const failure = response.ok ? null : await readApiError(response, "The test email could not be sent. Check the mail server, port, login and password.");
    const data = ((failure ? failure.data : await response.json()) ?? {}) as { ok?: boolean; to?: string; reason?: string };
    if (!failure && data.ok) {
      setSmtpMessage(`Test email sent to ${data.to}. Check the inbox.`);
      return;
    }
    if (data.reason === "SMTP_NOT_CONFIGURED") {
      setSmtpMessage("Email isn't fully set up yet. Save the mail server, login, from address and password first.");
      return;
    }
    setSmtpMessage(failure ? failure.message : "The test email could not be sent. Check the mail server, port, login and password.");
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

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Connections</h2>
        </div>
        <div className="grid gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">Document scanning key (Mistral)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saved securely. Only the last 4 characters are shown.
            </p>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
              <p>Status: {mistralKey.configured ? "Set up" : "Not set up"}</p>
              {mistralKey.last4 ? <p>Last 4: {mistralKey.last4}</p> : null}
              {mistralKey.updatedAt ? (
                <p suppressHydrationWarning>Updated: {new Date(mistralKey.updatedAt).toLocaleString()}</p>
              ) : null}
            </div>
          </div>
          <Form {...mistralForm}>
            <form onSubmit={mistralForm.handleSubmit(onSaveMistral)} className="grid gap-3 md:grid-cols-[1fr_auto]" noValidate>
              <FormField
                control={mistralForm.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="password" placeholder="Paste the new key" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={mistralForm.formState.isSubmitting}>
                {mistralForm.formState.isSubmitting ? "Saving..." : "Save key"}
              </Button>
            </form>
          </Form>
          {secretMessage ? <p className="text-sm text-muted-foreground">{secretMessage}</p> : null}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Email sending</h2>
        </div>
        <div className="grid gap-4 px-4 py-4">
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>
              Status:{" "}
              <span className={smtp.configured ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                {smtp.configured ? "Set up" : "Not set up"}
              </span>
            </p>
            <p>Used for invites, parent consent, password resets and reports sent to parents. The password is saved securely.</p>
            {smtp.passwordConfigured && smtp.passwordLast4 ? (
              <p suppressHydrationWarning>
                Password on file (last 4: {smtp.passwordLast4}
                {smtp.updatedAt ? ` · updated ${new Date(smtp.updatedAt).toLocaleString()}` : ""})
              </p>
            ) : null}
          </div>
          <Form {...smtpForm}>
            <form onSubmit={smtpForm.handleSubmit(onSaveSmtp)} className="space-y-4" noValidate>
              <FormSection>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={smtpForm.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mail server</FormLabel>
                        <FormControl>
                          <Input placeholder="smtp-relay.brevo.com" autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={smtpForm.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input placeholder="587" inputMode="numeric" autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={smtpForm.control}
                    name="user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email login</FormLabel>
                        <FormControl>
                          <Input placeholder="your-brevo-smtp-login" autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={smtpForm.control}
                    name="from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From address</FormLabel>
                        <FormControl>
                          <Input placeholder="noreply@yourdomain.com" autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={smtpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>
                          Password{" "}
                          {smtp.passwordConfigured ? (
                            <span className="text-muted-foreground">(leave blank to keep current)</span>
                          ) : null}
                        </FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Paste the password" autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={smtpForm.formState.isSubmitting}>
                  {smtpForm.formState.isSubmitting ? "Saving..." : "Save email settings"}
                </Button>
                <Button type="button" variant="secondary" onClick={testSmtp} disabled={smtpTesting}>
                  {smtpTesting ? "Sending..." : "Send test email"}
                </Button>
              </div>
            </form>
          </Form>
          {smtpMessage ? <p className="text-sm text-muted-foreground">{smtpMessage}</p> : null}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Optional features</h2>
        </div>
        <div className="divide-y divide-border">
          {settings.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between gap-4 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-foreground" title={setting.key}>{setting.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{setting.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(setting)}
                disabled={loadingKey === setting.key}
                className={`relative h-6 w-11 rounded-full transition ${
                  setting.value ? "bg-primary" : "bg-gray-300"
                } ${BLOCKED_SWITCH}`}
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
