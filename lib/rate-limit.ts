import { NextRequest, NextResponse } from "next/server";

// In-memory buckets: fine for the single web instance this platform runs (RNF-20).
type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Client IP as set by the reverse proxy (Caddy replaces any X-Forwarded-For the client sends). */
export function clientIpFromHeaders(headers?: Headers | null) {
  return (
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers?.get("x-real-ip") ||
    "unknown"
  );
}

function clientIp(req: NextRequest) {
  return clientIpFromHeaders(req.headers);
}

export function rateLimitKey(req: NextRequest, scope: string, subject?: string | null) {
  return `${scope}:${clientIp(req)}:${subject?.toLowerCase().trim() || "-"}`;
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
