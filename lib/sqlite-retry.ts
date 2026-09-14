const RETRYABLE_SQLITE_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);

export function isRetryableSqliteError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return RETRYABLE_SQLITE_CODES.has(code) || /database is locked|database table is locked/i.test(message);
}

/** Retry only transient SQLite lock errors; data and authorization errors surface immediately. */
export async function withSqliteRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (!isRetryableSqliteError(error) || attempt >= maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** (attempt - 1)));
    }
  }
}
