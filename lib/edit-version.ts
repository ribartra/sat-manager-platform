import { ConflictError } from "@/lib/api-error";

/**
 * Optimistic check for editors (practice set, Test, question): the editor sends the `updatedAt` it
 * loaded as `expectedUpdatedAt`; the save, inside its transaction, refuses when the row changed since.
 * Two teachers editing the same item no longer overwrite each other silently. Callers that send no
 * version (scripts, older clients) are not checked.
 */
export function expectedVersion(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Throws 409 when the stored version is not the one the editor loaded. Call inside the save's transaction. */
export function assertSameVersion(stored: Date | null | undefined, expected: Date | null) {
  if (!expected || !stored) return;
  // Compared in JS, not in SQL: rows written by raw SQL may keep updatedAt in another text format.
  if (stored.getTime() !== expected.getTime()) {
    throw new ConflictError("Someone else changed this since you opened it. Reload the page to see their changes.", { code: "STALE_EDIT" });
  }
}
