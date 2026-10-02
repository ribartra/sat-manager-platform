import { log } from "@/lib/observability";
import prisma from "@/lib/prisma";

export type AuditOutcome = "success" | "failure" | "info";

export type WriteAuditInput = {
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  outcome?: AuditOutcome;
  error?: unknown;
};

function serializeError(error: unknown): { name: string; message: string; stack?: string } | null {
  if (error == null) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.slice(0, 4000),
    };
  }
  return { name: "UnknownError", message: String(error).slice(0, 1000) };
}

/** Strip secrets from metadata before persistence. */
function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!metadata) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (lower.includes("password") || lower.includes("secret") || lower === "token") {
      if (typeof value === "string" && value.length > 0) {
        out[key] = `${value.slice(0, 8)}…`;
      } else {
        out[key] = "[redacted]";
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Persist an audit event. Never throws to callers — audit failures are logged to stderr.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  const meta = sanitizeMetadata(input.metadata);
  if (input.outcome) meta.outcome = input.outcome;
  const serialized = serializeError(input.error);
  if (serialized) meta.error = serialized;

  const payload = {
    userId: input.userId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: Object.keys(meta).length ? JSON.stringify(meta) : null,
  };

  try {
    await prisma.auditLog.create({ data: payload });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "writeAudit",
        action: input.action,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    );
  }
}

/**
 * Log a caught exception to stderr (structured JSON) and AuditLog as ERROR_CAUGHT.
 */
export async function captureCaughtError(
  scope: string,
  error: unknown,
  ctx?: { userId?: string | null; targetType?: string; targetId?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const serialized = serializeError(error);
  log.error("error.caught", { scope, ...serialized, ...(ctx?.metadata ?? {}) });
  await writeAudit({
    userId: ctx?.userId,
    action: "ERROR_CAUGHT",
    targetType: ctx?.targetType ?? "Scope",
    targetId: ctx?.targetId ?? scope,
    outcome: "failure",
    metadata: { scope, ...(ctx?.metadata ?? {}) },
    error,
  });
}
