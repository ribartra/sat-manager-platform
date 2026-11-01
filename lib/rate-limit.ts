import { NextRequest } from "next/server";
import { RateLimitError } from "@/lib/api-error";

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

/**
 * Failure-only limiter (login): `isRateLimited` peeks without counting, `recordFailure` counts a
 * failed attempt, `clearFailures` forgets them after a success. Successful sign-ins never
 * consume the budget, so many users behind one school network can sign in at once.
 */
export function isRateLimited(key: string, limit: number) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= Date.now()) return false;
  return current.count >= limit;
}

export function recordFailure(key: string, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else current.count += 1;
}

export function clearFailures(key: string) {
  buckets.delete(key);
}

export function rateLimitResponse(resetAt: number) {
  return new RateLimitError((resetAt - Date.now()) / 1000).toResponse();
}
