import { log, REQUEST_ID_HEADER } from "@/lib/observability";
import { NextResponse } from "next/server";
import { captureCaughtError } from "@/lib/audit";

/**
 * Superclass of every API error. Route handlers express failures as ApiError subclasses
 * (return `new ForbiddenError().toResponse()`, or `throw` inside `withApiErrors`) and the
 * client reads them back as ApiClientError (lib/api-client.ts). Wire format, stable for all
 * routes:
 *   { error: string, code: string, errors?: string[], ...extra }   with the matching HTTP status
 * `error` keeps the human message (older clients read only that key).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];
  readonly extra: Record<string, unknown>;
  readonly headers: Record<string, string>;

  constructor(
    status: number,
    message: string,
    options: { code?: string; details?: string[]; extra?: Record<string, unknown>; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = options.code ?? codeForStatus(status);
    this.details = options.details ?? [];
    this.extra = options.extra ?? {};
    this.headers = options.headers ?? {};
  }

  /** For statuses decided at runtime (e.g. forwarding the ingest service's status). */
  static fromStatus(status: number, message: string, extra?: Record<string, unknown>) {
    const Known = STATUS_CLASSES[status];
    if (Known) return new Known(message, extra ? { extra } : undefined);
    return new ApiError(status, message, { extra });
  }

  toResponse() {
    return NextResponse.json(
      { error: this.message, code: this.code, ...(this.details.length ? { errors: this.details } : {}), ...this.extra },
      { status: this.status, headers: Object.keys(this.headers).length ? this.headers : undefined },
    );
  }
}

type SubclassOptions = { code?: string; extra?: Record<string, unknown>; headers?: Record<string, string> };

export class BadRequestError extends ApiError {
  constructor(message = "Invalid request.", options?: SubclassOptions) {
    super(400, message, options);
  }
}

/** 400 with the list of field problems (shown by the client as a list). */
export class ValidationError extends ApiError {
  constructor(message = "Validation failed.", errors: string[] = [], options?: SubclassOptions) {
    super(400, message, { code: "VALIDATION_FAILED", ...options, details: errors });
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized", options?: SubclassOptions) {
    super(401, message, options);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", options?: SubclassOptions) {
    super(403, message, options);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found", options?: SubclassOptions) {
    super(404, message, options);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Conflict", options?: SubclassOptions) {
    super(409, message, options);
  }
}

export class UnprocessableError extends ApiError {
  constructor(message = "The request could not be processed.", options?: SubclassOptions) {
    super(422, message, options);
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message = "The upload is too large.", options?: SubclassOptions) {
    super(413, message, options);
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfterSeconds: number, message = "Too many requests. Try again later.") {
    super(429, message, { headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) } });
  }
}

/** Upstream dependency failed (ingest service, SMTP, storage). */
export class ServiceUnavailableError extends ApiError {
  constructor(message = "A required service is unavailable. Try again in a moment.", options?: SubclassOptions) {
    super(503, message, options);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = "Something went wrong on our side. Try again in a moment.", options?: SubclassOptions) {
    super(500, message, options);
  }
}

const STATUS_CLASSES: Record<number, new (message: string, options?: SubclassOptions) => ApiError> = {
  400: BadRequestError,
  401: UnauthorizedError,
  403: ForbiddenError,
  404: NotFoundError,
  409: ConflictError,
  413: PayloadTooLargeError,
  422: UnprocessableError,
  500: InternalServerError,
  503: ServiceUnavailableError,
};

function codeForStatus(status: number) {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 413: return "PAYLOAD_TOO_LARGE";
    case 422: return "UNPROCESSABLE";
    case 429: return "RATE_LIMITED";
    case 503: return "SERVICE_UNAVAILABLE";
    default: return status >= 500 ? "SERVER_ERROR" : "REQUEST_FAILED";
  }
}

/**
 * Wraps a route handler: a thrown ApiError becomes its response; anything else is logged
 * (captureCaughtError → AuditLog/console) and answered with a generic 500 in the same format,
 * never an HTML error page or a stack trace.
 */
export function withApiErrors<Args extends unknown[]>(handler: (...args: Args) => Promise<Response> | Response) {
  return async (...args: Args): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : null;
    const startedAt = Date.now();
    let response: Response | null = null;
    try {
      response = await handler(...args);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        response = error.toResponse();
        return response;
      }
      // next/navigation redirect()/notFound() signal through throws; let them through.
      if (error && typeof error === "object" && "digest" in error && typeof (error as { digest?: unknown }).digest === "string" && String((error as { digest: string }).digest).startsWith("NEXT_")) {
        throw error;
      }
      const path = request ? new URL(request.url).pathname : "unknown";
      await captureCaughtError(`api:${path}`, error, {
        metadata: { requestId: request?.headers.get(REQUEST_ID_HEADER) ?? undefined },
      }).catch(() => {});
      response = new InternalServerError().toResponse();
      return response;
    } finally {
      if (request && response) logAccess(request, response.status, Date.now() - startedAt);
    }
  };
}

/** One structured access line per API request (method, path, status, duration, request id). */
function logAccess(request: Request, status: number, ms: number) {
  const path = new URL(request.url).pathname;
  // Healthy probes (Docker every 30 s, uptime checks) would drown the log.
  if (status < 400 && path.startsWith("/api/health")) return;
  const fields = {
    method: request.method,
    path,
    status,
    ms,
    requestId: request.headers.get(REQUEST_ID_HEADER) ?? undefined,
  };
  if (status >= 500) log.error("http.request", fields);
  else if (status >= 400) log.warn("http.request", fields);
  else log.info("http.request", fields);
}
