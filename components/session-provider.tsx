"use client";

import { SessionProvider } from "next-auth/react";
import { useSessionGuards } from "@/hooks/use-session-guards";

function SessionGuards() {
  useSessionGuards();
  return null;
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuards />
      {children}
    </SessionProvider>
  );
}
