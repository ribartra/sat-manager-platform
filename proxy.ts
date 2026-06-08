import { NextRequest, NextResponse } from "next/server";
import { logApiEvent } from "@/lib/observability";

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

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = !origin || allowedOrigins().has(origin);

  if (!allowed) {
    logApiEvent("cors.blocked_origin", { origin, path: request.nextUrl.pathname });
  }

  if (request.method === "OPTIONS") {
    return applyCorsHeaders(new NextResponse(null, { status: allowed ? 204 : 403 }), origin);
  }

  return applyCorsHeaders(NextResponse.next(), origin);
}

export const config = {
  matcher: "/api/:path*",
};
