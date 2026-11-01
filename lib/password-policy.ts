/**
 * Single password rule for every flow that sets a password (activate, reset, change,
 * parent consent). The same limits back the client-side schema in contracts/auth.ts.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordPolicyError(password: unknown, email?: string | null): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  const localPart = email?.split("@")[0]?.trim().toLowerCase();
  if (localPart && localPart.length >= 3 && password.toLowerCase() === localPart) {
    return "Password must not be the same as your email name.";
  }
  return null;
}
