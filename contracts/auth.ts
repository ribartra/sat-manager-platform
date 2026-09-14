import { z } from "zod";

export const emailSchema = z.string().trim().min(1, "Email is required.").email("Enter a valid email.");

export const passwordSchema = z.string().min(6, "Password must be at least 6 characters.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirm: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.newPassword === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Activate account and parent-consent share the same password contract. */
export const activateSchema = setPasswordSchema;
export type ActivateInput = SetPasswordInput;

export const parentConsentSchema = setPasswordSchema;
export type ParentConsentInput = SetPasswordInput;
