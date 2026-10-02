import { z } from "@/lib/zod-config";
import { validateFullPracticeTestStructure } from "@/lib/full-test-validation";

export const fullTestEditorFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  reviewEnabled: z.boolean(),
  breakMinutes: z.number().int().min(0, "breakMinutes must be a non-negative integer."),
  moduleQuestionIds: z
    .array(z.array(z.string()))
    .length(4, "Full Practice Test must have exactly 4 modules."),
});

export type FullTestEditorInput = z.infer<typeof fullTestEditorFieldsSchema>;

/** Schema with SAT module structure rules (counts, section match, no duplicates). */
export function createFullTestEditorSchema(questionSections: Map<string, string>) {
  return fullTestEditorFieldsSchema.superRefine((data, ctx) => {
    const moduleQuestionIds = [
      data.moduleQuestionIds[0] ?? [],
      data.moduleQuestionIds[1] ?? [],
      data.moduleQuestionIds[2] ?? [],
      data.moduleQuestionIds[3] ?? [],
    ];
    const { errors } = validateFullPracticeTestStructure({
      status: data.status,
      moduleQuestionIds,
      questionSections,
    });
    for (const message of errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });
}

/** Field-level issues without DB section map (name/status/shape). */
export function fullTestEditorFieldIssues(data: unknown): string[] {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const normalized = {
    name: typeof raw.name === "string" ? raw.name : "",
    status: raw.status ?? "DRAFT",
    reviewEnabled: Boolean(raw.reviewEnabled ?? true),
    breakMinutes:
      typeof raw.breakMinutes === "number"
        ? raw.breakMinutes
        : Number.isFinite(Number(raw.breakMinutes))
          ? Number(raw.breakMinutes)
          : -1,
    moduleQuestionIds: Array.isArray(raw.moduleQuestionIds)
      ? Array.from({ length: 4 }, (_, index) => {
          const ids = raw.moduleQuestionIds?.[index as number];
          return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
        })
      : [[], [], [], []],
  };
  const parsed = fullTestEditorFieldsSchema.safeParse(normalized);
  if (parsed.success) return [];
  return [...new Set(parsed.error.issues.map((issue) => issue.message).filter(Boolean))];
}
