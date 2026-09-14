/** Stable TanStack Query keys for selective client server-state. */
export const queryKeys = {
  notifications: {
    all: ["notifications"] as const,
  },
  aiImport: {
    batchProgress: (batchId: string) => ["ai-import", "batch-progress", batchId] as const,
  },
};
