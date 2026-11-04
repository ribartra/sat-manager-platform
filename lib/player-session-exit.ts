"use client";

import { signOut } from "next-auth/react";
import { signOutCallbackUrl } from "@/lib/session-policy";

/** Best-effort pause then force login when auth is gone (401/403 or health fail). */
export async function exitPlayerOnAuthLoss(options: {
  pauseUrl?: string;
  reason?: "session" | "idle";
}) {
  if (options.pauseUrl) {
    try {
      await fetch(options.pauseUrl, { method: "POST", keepalive: true });
    } catch {
      // ignore
    }
  }
  await signOut({ callbackUrl: signOutCallbackUrl(options.reason ?? "session") });
}

export function isAuthFailureStatus(status: number) {
  return status === 401 || status === 403;
}
