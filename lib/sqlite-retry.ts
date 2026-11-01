/**
 * SQLite has one writer at a time (shared by the web app and the ingest service). A statement that
 * can't get the write lock within SQLITE_BUSY_TIMEOUT_MS fails; these helpers retry it after an async
 * pause instead of surfacing an error.
 *
 * The Prisma better-sqlite3 adapter reports SQLITE_BUSY as P1008 "Operation has timed out" (kind
 * SocketTimeout), not with the SQLite code, so all of those forms count as "busy".
 */
export const SQLITE_BUSY_TIMEOUT_MS = 2000;
export const SQLITE_RETRY_ATTEMPTS = 4;

const RETRYABLE_SQLITE_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED", "P1008"]);

export function isRetryableSqliteError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown; cause?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  if (RETRYABLE_SQLITE_CODES.has(code) || code.startsWith("SQLITE_BUSY")) return true;
  if (/database is locked|database table is locked|operation has timed out|SocketTimeout/i.test(message)) return true;
  // Driver adapter errors carry the original kind in `cause` ({ kind: "SocketTimeout" }).
  const cause = candidate.cause as { kind?: unknown; originalCode?: unknown } | undefined;
  return Boolean(cause && (cause.kind === "SocketTimeout" || cause.originalCode === "SQLITE_BUSY"));
}

/** 150, 300, 600 ms… between tries. */
export function sqliteRetryDelay(attempt: number) {
  return 150 * 2 ** (attempt - 1);
}

/** Retry only transient SQLite lock errors; data and authorization errors surface immediately. */
export async function withSqliteRetry<T>(operation: () => Promise<T>, maxAttempts = SQLITE_RETRY_ATTEMPTS): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (!isRetryableSqliteError(error) || attempt >= maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, sqliteRetryDelay(attempt)));
    }
  }
}
