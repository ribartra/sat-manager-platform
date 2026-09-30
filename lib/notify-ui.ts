"use client";

import { toast } from "sonner";
import { ApiClientError, errorMessage } from "@/lib/api-client";

/**
 * Transient feedback (replaces window.alert). Errors keep the server's message and list the
 * validation details; persistent problems belong in an <Alert> inside the view instead.
 */
export const notify = {
  error(error: unknown, fallback?: string) {
    const details = error instanceof ApiClientError && error.details.length > 1 ? error.details.join(" · ") : undefined;
    toast.error(error instanceof ApiClientError && details ? error.message : errorMessage(error, fallback), {
      description: details,
    });
  },
  success(message: string, description?: string) {
    toast.success(message, { description });
  },
  info(message: string, description?: string) {
    toast(message, { description });
  },
};
