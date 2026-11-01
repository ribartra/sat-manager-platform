/**
 * Per-question review tools sent by the players (mark for review, personal note, eliminated
 * choices), normalised for storage in AttemptAnswer / FullPracticeTestAnswer.
 * eliminatedOptions is stored as a JSON array of option labels.
 */
export interface ReviewMetaInput {
  markedQuestionIds?: unknown;
  notes?: unknown;
  eliminatedOptions?: unknown;
}

export interface ReviewMeta {
  markedForReview: boolean;
  note: string | null;
  eliminatedOptions: string | null;
}

const NOTE_MAX_LENGTH = 2000;

/** Returns review meta for every question the payload mentions (only ids in `allowedIds`). */
export function reviewMetaByQuestion(input: ReviewMetaInput, allowedIds: Set<string>) {
  const marked = new Set(Array.isArray(input.markedQuestionIds) ? input.markedQuestionIds.filter((id): id is string => typeof id === "string") : []);
  const notes = input.notes && typeof input.notes === "object" ? (input.notes as Record<string, unknown>) : {};
  const eliminated =
    input.eliminatedOptions && typeof input.eliminatedOptions === "object"
      ? (input.eliminatedOptions as Record<string, unknown>)
      : {};
  const hasMarkedList = Array.isArray(input.markedQuestionIds);
  const ids = new Set<string>([...marked, ...Object.keys(notes), ...Object.keys(eliminated)]);
  const result = new Map<string, Partial<ReviewMeta>>();
  for (const id of ids) {
    if (!allowedIds.has(id)) continue;
    const meta: Partial<ReviewMeta> = {};
    if (hasMarkedList) meta.markedForReview = marked.has(id);
    if (id in notes) {
      const note = typeof notes[id] === "string" ? (notes[id] as string).slice(0, NOTE_MAX_LENGTH) : "";
      meta.note = note.trim() ? note : null;
    }
    if (id in eliminated) {
      const labels = Array.isArray(eliminated[id])
        ? (eliminated[id] as unknown[]).filter((label): label is string => typeof label === "string" && /^[A-J]$/.test(label))
        : [];
      meta.eliminatedOptions = labels.length ? JSON.stringify([...new Set(labels)].sort()) : null;
    }
    result.set(id, meta);
  }
  // markedIds is the full marked set: callers unmark stored rows that are not in it.
  return { byQuestion: result, markedIds: hasMarkedList ? marked : null };
}

export function parseEliminatedOptions(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === "string") : [];
  } catch {
    return [];
  }
}
