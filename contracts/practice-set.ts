import { z } from "@/lib/zod-config";
import { validatePracticeSetPayload } from "@/lib/content-validation";

export const practiceSetEditorSchema = z
  .object({
    name: z.string(),
    topicId: z.string(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    status: z.enum(["DRAFT", "PUBLISHED", "BLOCKED", "ARCHIVED"]),
    explanationVisibility: z.enum(["IMMEDIATE", "AFTER_FINISH", "HIDDEN"]),
    questionIds: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    for (const message of validatePracticeSetPayload(data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export type PracticeSetEditorInput = z.infer<typeof practiceSetEditorSchema>;

/** Flatten Zod issues to the same string[] shape the Practice Set APIs return. */
export function practiceSetEditorIssues(data: unknown): string[] {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const normalized = {
    name: typeof raw.name === "string" ? raw.name : "",
    topicId: typeof raw.topicId === "string" ? raw.topicId : "",
    difficulty: raw.difficulty,
    status: raw.status ?? "DRAFT",
    explanationVisibility: raw.explanationVisibility ?? "AFTER_FINISH",
    questionIds: Array.isArray(raw.questionIds) ? raw.questionIds.filter((id): id is string => typeof id === "string") : [],
  };
  const parsed = practiceSetEditorSchema.safeParse(normalized);
  if (parsed.success) return [];
  return [...new Set(parsed.error.issues.map((issue) => issue.message).filter(Boolean))];
}
