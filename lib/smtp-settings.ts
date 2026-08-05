import prisma from "@/lib/prisma";
import { decryptSecret, encryptSecret, secretSummary } from "@/lib/secret-settings";

// SMTP configuration is parameterizable from /admin/settings and stored in AppSetting.
// The password is encrypted at rest (AES-256-GCM); other fields are plain.
// Any field missing from the database falls back to the matching EMAIL_* env var.
export const SMTP_SETTING_KEYS = {
  host: "SMTP_HOST",
  port: "SMTP_PORT",
  user: "SMTP_USER",
  from: "SMTP_FROM",
  password: "SMTP_PASSWORD_ENCRYPTED",
} as const;

const ALL_KEYS = Object.values(SMTP_SETTING_KEYS);

export type SmtpConfig = {
  host: string | null;
  port: number;
  user: string | null;
  from: string | null;
  pass: string | null;
  configured: boolean;
};

export type SmtpSummary = {
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

async function loadRows(): Promise<Map<string, string>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ALL_KEYS } } });
  return new Map(rows.map((row) => [row.key, row.value]));
}

function envValue(key: string): string | null {
  switch (key) {
    case SMTP_SETTING_KEYS.host:
      return process.env.EMAIL_HOST ?? null;
    case SMTP_SETTING_KEYS.port:
      return process.env.EMAIL_PORT ?? null;
    case SMTP_SETTING_KEYS.user:
      return process.env.EMAIL_USER ?? null;
    case SMTP_SETTING_KEYS.from:
      return process.env.EMAIL_FROM ?? null;
    default:
      return null;
  }
}

/** Effective SMTP config used to actually send mail: DB value per field, else env fallback. */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  const rows = await loadRows();

  const host = rows.get(SMTP_SETTING_KEYS.host) || envValue(SMTP_SETTING_KEYS.host);
  const user = rows.get(SMTP_SETTING_KEYS.user) || envValue(SMTP_SETTING_KEYS.user);
  const from = rows.get(SMTP_SETTING_KEYS.from) || envValue(SMTP_SETTING_KEYS.from);
  const portRaw = rows.get(SMTP_SETTING_KEYS.port) || envValue(SMTP_SETTING_KEYS.port);
  const port = Number(portRaw) > 0 ? Number(portRaw) : 587;
  const pass = decryptSecret(rows.get(SMTP_SETTING_KEYS.password)) || process.env.EMAIL_PASS || null;

  return {
    host: host || null,
    port,
    user: user || null,
    from: from || null,
    pass,
    configured: Boolean(host && user && from && pass),
  };
}

/** Non-secret summary for the admin UI. Never returns the raw password. */
export async function getSmtpSummary(): Promise<SmtpSummary> {
  const rows = await loadRows();
  const dbPassword = secretSummary(rows.get(SMTP_SETTING_KEYS.password));
  const config = await getSmtpConfig();

  const dbFieldSet = ALL_KEYS.some((key) => rows.has(key));
  const envFieldSet = Boolean(
    process.env.EMAIL_HOST || process.env.EMAIL_USER || process.env.EMAIL_FROM || process.env.EMAIL_PASS
  );
  const source: SmtpSummary["source"] = dbFieldSet && envFieldSet ? "mixed" : dbFieldSet ? "database" : envFieldSet ? "env" : "none";

  return {
    host: config.host,
    port: config.port,
    user: config.user,
    from: config.from,
    passwordConfigured: Boolean(config.pass),
    passwordLast4: dbPassword.last4 ?? (process.env.EMAIL_PASS ? process.env.EMAIL_PASS.slice(-4) : null),
    updatedAt: dbPassword.updatedAt,
    configured: config.configured,
    source,
  };
}

export type SmtpInput = {
  host?: string;
  port?: number | string;
  user?: string;
  from?: string;
  password?: string; // optional: blank keeps the stored password
};

/** Upsert SMTP settings. A blank/absent password leaves the stored one untouched. */
export async function saveSmtpConfig(input: SmtpInput): Promise<void> {
  const updates: Array<{ key: string; value: string }> = [];

  if (typeof input.host === "string") updates.push({ key: SMTP_SETTING_KEYS.host, value: input.host.trim() });
  if (typeof input.user === "string") updates.push({ key: SMTP_SETTING_KEYS.user, value: input.user.trim() });
  if (typeof input.from === "string") updates.push({ key: SMTP_SETTING_KEYS.from, value: input.from.trim() });
  if (input.port !== undefined && input.port !== "") {
    const port = Number(input.port);
    if (Number.isFinite(port) && port > 0) updates.push({ key: SMTP_SETTING_KEYS.port, value: String(Math.trunc(port)) });
  }

  const password = typeof input.password === "string" ? input.password.trim() : "";
  if (password) updates.push({ key: SMTP_SETTING_KEYS.password, value: encryptSecret(password) });

  await prisma.$transaction(
    updates.map((row) =>
      prisma.appSetting.upsert({
        where: { key: row.key },
        update: { value: row.value },
        create: { key: row.key, value: row.value },
      })
    )
  );
}
