import prisma from "@/lib/prisma";

/**
 * Attempts reference a question's images, they never copy them: snapshots freeze the text, options
 * and answer key (grading depends on them) but the stem / option images always come from the live
 * Question by id, so a re-cropped image in the bank also fixes attempts already taken.
 */
export type LiveQuestionMedia = Map<string, { imageUrl: string | null; options: Map<string, string | null> }>;

export async function loadLiveQuestionMedia(questionIds: string[]): Promise<LiveQuestionMedia> {
  const ids = [...new Set(questionIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, imageUrl: true, options: { select: { label: true, imageUrl: true } } },
  });
  return new Map(rows.map((q) => [q.id, { imageUrl: q.imageUrl, options: new Map(q.options.map((o) => [o.label, o.imageUrl])) }]));
}

/** The question with its images taken from the live bank question (unchanged when the question no longer exists). */
export function withLiveMedia<Q extends { id: string; imageUrl?: string | null; options?: { label: string; imageUrl?: string | null }[] }>(
  question: Q,
  media: LiveQuestionMedia,
): Q {
  const live = media.get(question.id);
  if (!live) return question;
  return {
    ...question,
    imageUrl: live.imageUrl,
    options: question.options?.map((option) => ({ ...option, imageUrl: live.options.has(option.label) ? live.options.get(option.label) ?? null : option.imageUrl ?? null })),
  };
}

/** Images of a frozen question taken from the live question already loaded (practice results pages). */
export function liveImagesOf(
  live: { imageUrl: string | null; options?: { label: string; imageUrl: string | null }[] } | null | undefined,
  frozenOptions: { label: string; text: string; imageUrl?: string | null }[],
) {
  const optionImages = new Map((live?.options ?? []).map((o) => [o.label, o.imageUrl]));
  return {
    imageUrl: live ? live.imageUrl : null,
    options: frozenOptions.map((option) => ({ ...option, imageUrl: optionImages.has(option.label) ? optionImages.get(option.label) ?? null : option.imageUrl ?? null })),
  };
}
