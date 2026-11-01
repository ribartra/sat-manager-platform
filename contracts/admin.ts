import { z } from "@/lib/zod-config";

export const mistralKeySchema = z.object({
  apiKey: z.string().trim().min(20, "API key is too short."),
});
export type MistralKeyInput = z.infer<typeof mistralKeySchema>;

export const smtpSettingsSchema = z.object({
  host: z.string(),
  port: z
    .string()
    .refine((value) => value.trim() === "" || (/^\d+$/.test(value.trim()) && Number(value) > 0), {
      message: "Port must be a positive number.",
    }),
  user: z.string(),
  from: z
    .string()
    .refine((value) => value.trim() === "" || z.string().email().safeParse(value.trim()).success, {
      message: "Enter a valid from address.",
    }),
  password: z.string().optional(),
});
export type SmtpSettingsInput = z.infer<typeof smtpSettingsSchema>;

export const createProgramSchema = z
  .object({
    name: z.string().trim().min(1, "Program name is required."),
    teacherId: z.string().min(1, "Select a teacher."),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    { message: "End date must be on or after start date.", path: ["endDate"] },
  );
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const editProgramSchema = z
  .object({
    name: z.string().trim().min(1, "Program name is required."),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().optional(),
    active: z.boolean(),
  })
  .refine(
    (data) => !data.endDate || data.endDate >= data.startDate,
    { message: "End date must be on or after start date.", path: ["endDate"] },
  );
export type EditProgramInput = z.infer<typeof editProgramSchema>;

export const taxonomyNodeTypes = ["AREA", "DOMAIN", "SKILL", "SUBSKILL"] as const;

export const createTaxonomyNodeSchema = z.object({
  parentId: z.string().optional(),
  type: z.enum(taxonomyNodeTypes),
  name: z.string().trim().min(1, "Node name is required."),
});
export type CreateTaxonomyNodeInput = z.infer<typeof createTaxonomyNodeSchema>;
