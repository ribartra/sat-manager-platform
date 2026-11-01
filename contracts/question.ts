import { z } from "@/lib/zod-config";
import { validateQuestionPayload } from "@/lib/content-validation";

export const questionOptionSchema = z.object({
  label: z.string(),
  text: z.string(),
  imageUrl: z.string().nullable().optional(),
});

export const DEFAULT_MC_OPTIONS = [
  { label: "A", text: "", imageUrl: "" },
  { label: "B", text: "", imageUrl: "" },
  { label: "C", text: "", imageUrl: "" },
  { label: "D", text: "", imageUrl: "" },
] as const;

export const questionEditorSchema = z
  .object({
    topicId: z.string(),
    subskillId: z.string().nullable().optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    type: z.enum(["MC", "NUMERIC"]),
    stem: z.string(),
    stimulus: z.string(),
    explanation: z.string(),
    imageUrl: z.string(),
    supportsGraph: z.boolean(),
    correctAnswer: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    options: z.array(questionOptionSchema),
  })
  .superRefine((data, ctx) => {
    for (const message of validateQuestionPayload(data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export type QuestionEditorInput = z.infer<typeof questionEditorSchema>;

/** Flatten Zod issues to the same string[] shape the question APIs return. */
export function questionEditorIssues(data: unknown): string[] {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const normalized = {
    topicId: typeof raw.topicId === "string" ? raw.topicId : "",
    subskillId: typeof raw.subskillId === "string" ? raw.subskillId : raw.subskillId === null ? null : undefined,
    difficulty: raw.difficulty,
    type: raw.type ?? "MC",
    stem: typeof raw.stem === "string" ? raw.stem : "",
    stimulus: typeof raw.stimulus === "string" ? raw.stimulus : "",
    explanation: raw.explanation == null ? "" : String(raw.explanation),
    imageUrl: raw.imageUrl == null ? "" : String(raw.imageUrl),
    supportsGraph: Boolean(raw.supportsGraph),
    correctAnswer: typeof raw.correctAnswer === "string" ? raw.correctAnswer : "",
    status: raw.status ?? "DRAFT",
    options: Array.isArray(raw.options) ? raw.options : [],
  };
  const parsed = questionEditorSchema.safeParse(normalized);
  if (parsed.success) return [];
  return [...new Set(parsed.error.issues.map((issue) => issue.message).filter(Boolean))];
}
