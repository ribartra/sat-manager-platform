"use client";

import { fetchWithTransientRetry } from "@/lib/transient-fetch";

/**
 * Client side of the API error contract (see lib/api-error.ts). Every failed call becomes an
 * ApiClientError with the server's message, so views never parse `data.error` by hand.
 *   try { const data = await apiFetch<{ id: string }>("/api/x", { method: "POST", json: body }); }
 *   catch (err) { notify.error(err) }   // or setError(errorMessage(err))
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];
  readonly data: unknown;

  constructor(message: string, { status, code, details = [], data }: { status: number; code?: string; details?: string[]; data?: unknown }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code ?? codeForStatus(status);
    this.details = details;
    this.data = data;
  }

  get isAuth() {
    return this.status === 401 || this.status === 403;
  }

  get isNetwork() {
    return this.status === 0;
  }
}

function codeForStatus(status: number) {
  if (status === 0) return "NETWORK_ERROR";
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  return status >= 500 ? "SERVER_ERROR" : "REQUEST_FAILED";
}

const FALLBACK_BY_STATUS: Record<number, string> = {
  0: "You seem to be offline. Check your connection and try again.",
  401: "Your session ended. Sign in again.",
  403: "You don't have permission to do this.",
  404: "This item no longer exists.",
  429: "Too many requests. Wait a moment and try again.",
};

/** Builds an ApiClientError from a non-OK response (reads `{ error, code, errors }`). */
export async function readApiError(res: Response, fallback = "The request failed. Try again."): Promise<ApiClientError> {
  const data = (await res.json().catch(() => null)) as { error?: unknown; code?: unknown; errors?: unknown } | null;
  const details = Array.isArray(data?.errors) ? data.errors.map(String) : [];
  const message =
    (typeof data?.error === "string" && data.error) ||
    details[0] ||
    FALLBACK_BY_STATUS[res.status] ||
    (res.status >= 500 ? "Something went wrong on our side. Try again in a moment." : fallback);
  return new ApiClientError(message, { status: res.status, code: typeof data?.code === "string" ? data.code : undefined, details, data });
}

export interface ApiFetchInit extends Omit<RequestInit, "body"> {
  /** JSON body (sets the Content-Type header). */
  json?: unknown;
  body?: BodyInit | null;
  /** Retry 502/503/504 and network drops (safe for idempotent or autosave calls). */
  retry?: boolean;
  /** Message used when the server does not send one. */
  fallback?: string;
}

/** fetch + JSON + error normalization. Resolves with the parsed body; throws ApiClientError. */
export async function apiFetch<T = unknown>(url: string, init: ApiFetchInit = {}): Promise<T> {
  const { json, retry, fallback, headers, ...rest } = init;
  const request: RequestInit = {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(headers ?? {}) } : headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  };
  let res: Response;
  try {
    res = retry ? await fetchWithTransientRetry(url, request) : await fetch(url, request);
  } catch (cause) {
    throw new ApiClientError(FALLBACK_BY_STATUS[0], { status: 0, data: cause });
  }
  if (!res.ok) throw await readApiError(res, fallback);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? await res.json() : await res.text()) as T;
}

/** Human message for any thrown value (ApiClientError, Error or string). */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (error instanceof ApiClientError) return error.details.length > 1 ? [error.message, ...error.details.filter((d) => d !== error.message)].join(" ") : error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
