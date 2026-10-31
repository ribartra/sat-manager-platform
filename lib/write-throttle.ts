/**
 * In-memory write throttle (one Node process): lets a low-value write (last-active stamp, "resumed"
 * audit on a page load) happen at most once per interval per key, so frequent requests don't each add
 * a commit to the single SQLite writer. After a restart the first call writes again, which is harmless.
 */
// On globalThis: one map per process, shared by every server bundle (pages, route handlers) and HMR.
const globalForThrottle = globalThis as unknown as { writeThrottle?: Map<string, number> };
const nextAllowedAt = (globalForThrottle.writeThrottle ??= new Map<string, number>());
const PRUNE_ABOVE = 5000;

/** True when the caller should write now (and reserves the slot until `intervalMs` from now). */
export function claimWriteSlot(key: string, intervalMs: number, now = Date.now()): boolean {
  const allowedAt = nextAllowedAt.get(key);
  if (allowedAt !== undefined && now < allowedAt) return false;
  nextAllowedAt.set(key, now + intervalMs);
  if (nextAllowedAt.size > PRUNE_ABOVE) {
    for (const [entry, at] of nextAllowedAt) if (at <= now) nextAllowedAt.delete(entry);
  }
  return true;
}

/** Frees a slot (the write it reserved failed), so the next call tries again. */
export function releaseWriteSlot(key: string) {
  nextAllowedAt.delete(key);
}

/** A player page reopened within this window is the same sitting: no new "resumed" audit entry. */
export const RESUME_AUDIT_INTERVAL_MS = 30 * 60_000;
