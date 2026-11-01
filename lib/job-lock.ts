import { ConflictError } from "@/lib/api-error";

/**
 * In-process job lock: at most one job of a kind runs at a time. Promotions and imports write a lot
 * through the single SQLite writer; two at once double the time every other user waits. The web app
 * runs as ONE Node process (next start, no cluster), so an in-memory lock is enough; with several
 * processes this would have to become a row in the database.
 */
const globalForJobs = globalThis as unknown as { runningJobs?: Set<string> };
const running = (globalForJobs.runningJobs ??= new Set<string>());

/** Promotions and imports of content (AI import, quick import, candidate merge) share this lock. */
export const CONTENT_JOB = "content-import";

export async function withJobLock<T>(name: string, work: () => Promise<T>): Promise<T> {
  if (running.has(name)) {
    throw new ConflictError("Another import or promotion is running. Try again in a minute.", { code: "JOB_BUSY" });
  }
  running.add(name);
  try {
    return await work();
  } finally {
    running.delete(name);
  }
}

/** Wraps a route handler so it runs under `withJobLock(name)` (use inside withApiErrors). */
export function exclusiveJob<A extends unknown[], R>(name: string, handler: (...args: A) => Promise<R>) {
  return (...args: A) => withJobLock(name, () => handler(...args));
}
