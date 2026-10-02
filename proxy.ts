import { NextRequest, NextResponse } from "next/server";
import { buildCsp, createNonce } from "@/lib/csp";
import { logApiEvent, REQUEST_ID_HEADER, resolveRequestId } from "@/lib/observability";

const DEFAULT_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function parseOrigins(value?: string) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOrigins() {
  const origins = new Set(parseOrigins(process.env.CORS_ALLOWED_ORIGINS));
  const authOrigin = normalizeOrigin(process.env.AUTH_URL);

  if (authOrigin) {
    origins.add(authOrigin);
  }

  if (process.env.NODE_ENV !== "production") {
    DEFAULT_DEV_ORIGINS.forEach((origin) => origins.add(origin));
  }

  return origins;
}

function applyCorsHeaders(response: NextResponse, origin: string | null) {
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );

  if (origin && allowedOrigins().has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

function handleApi(request: NextRequest, requestHeaders: Headers) {
  const origin = request.headers.get("origin");
  const allowed = !origin || allowedOrigins().has(origin);

  if (!allowed) {
    logApiEvent("cors.blocked_origin", {
      origin,
      path: request.nextUrl.pathname,
      requestId: requestHeaders.get(REQUEST_ID_HEADER),
    });
  }

  if (request.method === "OPTIONS") {
    return applyCorsHeaders(new NextResponse(null, { status: allowed ? 204 : 403 }), origin);
  }

  return applyCorsHeaders(NextResponse.next({ request: { headers: requestHeaders } }), origin);
}

export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  let response: NextResponse;
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response = handleApi(request, requestHeaders);
  } else {
    // Pages: per-request nonce. Next reads the CSP from the request headers and stamps the
    // nonce on its own <script> tags; the app tree is force-dynamic, so every render is fresh.
    const nonce = createNonce();
    const csp = buildCsp(nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
  }

  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    // Every page except static assets and media (those carry no document CSP).
    {
      source: "/((?!api/|_next/static|_next/image|favicon|uploads/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
