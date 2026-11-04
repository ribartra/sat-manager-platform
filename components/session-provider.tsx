"use client";

import { SessionProvider } from "next-auth/react";
import { useSessionGuards } from "@/hooks/use-session-guards";
import { SESSION_REFRESH_SECONDS } from "@/lib/session-policy";

function SessionGuards() {
  useSessionGuards();
  return null;
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    // Renews the 30-minute session cookie while a tab is open (the idle guard signs out when unused).
    <SessionProvider refetchInterval={SESSION_REFRESH_SECONDS}>
      <SessionGuards />
      {children}
    </SessionProvider>
  );
}
