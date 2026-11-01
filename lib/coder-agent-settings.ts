import { randomBytes, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { encryptSecret, decryptSecret, secretSummary, sha256Fingerprint } from "@/lib/secret-settings";

// Coding agent for "Report a problem" (lib/issue-report-server.ts): each new report is POSTed to the
// agent's URL, and the agent calls back /api/agent/issue-reports/[id] to say it took or fixed it.
// Set in Admin → Settings (AppSetting); each field falls back to its CODER_AGENT_* env var.
// An empty URL means the agent is off — nothing is sent.
export const CODER_AGENT_SETTING_KEYS = {
  url: "CODER_AGENT_URL",
  /** Bearer token the app sends to the agent (AES-256-GCM at rest). */
  token: "CODER_AGENT_TOKEN_ENCRYPTED",
  /** SHA-256 of the token the agent sends back; the token itself is shown once and never stored. */
  callbackHash: "CODER_AGENT_CALLBACK_TOKEN_HASH",
} as const;

const ALL_KEYS = Object.values(CODER_AGENT_SETTING_KEYS);

export type CoderAgentConfig = { url: string | null; token: string | null; enabled: boolean };

export type CoderAgentSummary = {
  url: string | null;
  enabled: boolean;
  tokenConfigured: boolean;
  tokenLast4: string | null;
  callbackTokenConfigured: boolean;
  callbackTokenUpdatedAt: string | null;
  source: "database" | "env" | "mixed" | "none";
};

async function loadRows(): Promise<Map<string, string>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ALL_KEYS } } });
  return new Map(rows.map((row) => [row.key, row.value]));
}

const env = (name: string) => process.env[name]?.trim() || null;

export async function getCoderAgentConfig(): Promise<CoderAgentConfig> {
  const rows = await loadRows();
  // A saved empty URL turns the agent off even if the env var is set.
  const url = rows.has(CODER_AGENT_SETTING_KEYS.url) ? rows.get(CODER_AGENT_SETTING_KEYS.url) || null : env("CODER_AGENT_URL");
  const token = decryptSecret(rows.get(CODER_AGENT_SETTING_KEYS.token)) || env("CODER_AGENT_TOKEN");
  return { url, token, enabled: Boolean(url) };
}

function callbackHashFromRow(row: string | undefined): { hash: string; updatedAt: string | null } | null {
  if (!row) return null;
  try {
    const parsed = JSON.parse(row) as { sha256?: string; updatedAt?: string };
    return parsed.sha256 ? { hash: parsed.sha256, updatedAt: parsed.updatedAt ?? null } : null;
  } catch {
    return null;
  }
}

/** Whether a callback token is set at all (no token → the agent endpoint answers 503). */
export async function callbackTokenConfigured() {
  const rows = await loadRows();
  return Boolean(callbackHashFromRow(rows.get(CODER_AGENT_SETTING_KEYS.callbackHash)) || env("CODER_AGENT_CALLBACK_TOKEN"));
}

/** Timing-safe check of the agent's Bearer token against the stored hash (or the env token). */
export async function verifyCallbackToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const rows = await loadRows();
  const stored = callbackHashFromRow(rows.get(CODER_AGENT_SETTING_KEYS.callbackHash));
  const expected = stored?.hash ?? (env("CODER_AGENT_CALLBACK_TOKEN") ? sha256Fingerprint(env("CODER_AGENT_CALLBACK_TOKEN")!) : null);
  if (!expected) return false;
  const a = Buffer.from(sha256Fingerprint(token.trim()), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getCoderAgentSummary(): Promise<CoderAgentSummary> {
  const rows = await loadRows();
  const config = await getCoderAgentConfig();
  const token = secretSummary(rows.get(CODER_AGENT_SETTING_KEYS.token));
  const callback = callbackHashFromRow(rows.get(CODER_AGENT_SETTING_KEYS.callbackHash));
  const dbSet = ALL_KEYS.some((key) => rows.has(key));
  const envSet = Boolean(env("CODER_AGENT_URL") || env("CODER_AGENT_TOKEN") || env("CODER_AGENT_CALLBACK_TOKEN"));
  return {
    url: config.url,
    enabled: config.enabled,
    tokenConfigured: Boolean(config.token),
    tokenLast4: token.last4 ?? (env("CODER_AGENT_TOKEN") ? env("CODER_AGENT_TOKEN")!.slice(-4) : null),
    callbackTokenConfigured: Boolean(callback || env("CODER_AGENT_CALLBACK_TOKEN")),
    callbackTokenUpdatedAt: callback?.updatedAt ?? null,
    source: dbSet && envSet ? "mixed" : dbSet ? "database" : envSet ? "env" : "none",
  };
}

/** "" or an http(s) URL; anything else is rejected. */
export function normalizeAgentUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Saves the URL (empty turns the agent off) and, when given, a new outbound token. */
export async function saveCoderAgentConfig(input: { url: string; token?: string }) {
  const updates: { key: string; value: string }[] = [{ key: CODER_AGENT_SETTING_KEYS.url, value: input.url }];
  const token = input.token?.trim();
  if (token) updates.push({ key: CODER_AGENT_SETTING_KEYS.token, value: encryptSecret(token) });
  await prisma.$transaction(
    updates.map((row) => prisma.appSetting.upsert({ where: { key: row.key }, update: { value: row.value }, create: row })),
  );
}

/** New callback token: only its hash is kept; the caller shows the token once. */
export async function rotateCallbackToken(): Promise<string> {
  const token = `sat_agent_${randomBytes(24).toString("base64url")}`;
  const value = JSON.stringify({ sha256: sha256Fingerprint(token), updatedAt: new Date().toISOString() });
  await prisma.appSetting.upsert({
    where: { key: CODER_AGENT_SETTING_KEYS.callbackHash },
    update: { value },
    create: { key: CODER_AGENT_SETTING_KEYS.callbackHash, value },
  });
  return token;
}
