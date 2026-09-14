"use client";

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

/** Retry only transient network/proxy failures; auth and data errors surface immediately. */
export async function fetchWithTransientRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(input, init);
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= maxAttempts - 1) return response;
      attempt += 1;
      await wait(400 * 2 ** (attempt - 1));
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts) throw error;
      await wait(400 * 2 ** (attempt - 1));
    }
  }
}
