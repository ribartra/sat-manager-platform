/** Prisma unique-constraint violation (P2002), including the partial unique indexes added by raw migrations. */
export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002",
  );
}
