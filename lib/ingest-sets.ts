// Client-safe types + pure filtering for ingest "conjuntos". A conjunto is one
// ingest source document (a Practice Set PDF, or a Full Practice Test section
// file). The server-side row computation lives in lib/ingest-sets.server.ts;
// this module is importable from client components (the sets index and the
// review rail) because it has no prisma / server-only dependency.

export interface SetRow {
  sourceFileId: string;
  batchId: string;
  relativePath: string;
  title: string;
  contentType: string;
  section: string | null;
  difficulty: string | null;
  testNumber: number | null;
  status: string;
  total: number;
  answerable: number;
  pending: number;
  sinResp: number;
  faltanOpt: number;
  promoted: number;
}

export type SetTypeFilter = "ALL" | "PRACTICE_SET" | "FULL_PRACTICE_TEST";
export type SetSectionFilter = "ALL" | "RW" | "MATH";

export interface SetFilterState {
  query: string;
  type: SetTypeFilter;
  section: SetSectionFilter;
  onlyPending: boolean;
}

// Shared filter + sort used by both the full-page index and the review rail so
// the two can never drift. Full tests first (TEST 1 → TEST 10, R&W before Math),
// then practice sets ordered by most-pending.
export function filterSetRows(rows: SetRow[], { query, type, section, onlyPending }: SetFilterState): SetRow[] {
  const q = query.trim().toLowerCase();
  const matched = rows.filter((row) => {
    if (type !== "ALL" && row.contentType !== type) return false;
    if (section !== "ALL" && (row.section ?? "") !== section) return false;
    if (onlyPending && row.pending === 0) return false;
    if (!q) return true;
    const haystack = [row.title, row.relativePath, row.section, row.difficulty, row.testNumber ? `test ${row.testNumber}` : null]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  return matched.sort((a, b) => {
    const ta = a.testNumber ?? Number.POSITIVE_INFINITY;
    const tb = b.testNumber ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    const sa = a.section === "MATH" ? 1 : 0;
    const sb = b.section === "MATH" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (b.pending !== a.pending) return b.pending - a.pending;
    return a.title.localeCompare(b.title);
  });
}
