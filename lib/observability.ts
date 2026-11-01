/**
 * Structured logging: one JSON object per line on stdout/stderr, picked up by Docker and the
 * Ops Agent (Cloud Logging parses `severity`/`level`). Every line can carry the request id that
 * proxy.ts assigns, so one request can be followed across access, audit and error lines.
 */
export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/** Reuse an upstream request id (Caddy/LB) when it looks sane; otherwise mint one. */
export function resolveRequestId(incoming: string | null | undefined) {
  return incoming && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID();
}

type Level = "debug" | "info" | "warn" | "error";
const SEVERITY: Record<Level, string> = { debug: "DEBUG", info: "INFO", warn: "WARNING", error: "ERROR" };

function emit(level: Level, event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({
    severity: SEVERITY[level],
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  debug: (event: string, fields: Record<string, unknown> = {}) => emit("debug", event, fields),
  info: (event: string, fields: Record<string, unknown> = {}) => emit("info", event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => emit("warn", event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => emit("error", event, fields),
};

export function logApiEvent(event: string, metadata: Record<string, unknown> = {}) {
  log.info(event, metadata);
}
