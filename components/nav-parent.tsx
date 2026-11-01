"use client";

import { AppShell } from "@/components/app-shell";
import { PARENT_NAV, resolveLinks } from "@/lib/nav-config";

/** Parent chrome: the same left sidebar as every portal (Home, Notifications, Report a problem, account). */
export function ParentShell({ userName, avatarUrl, children }: { userName: string; avatarUrl?: string | null; children: React.ReactNode }) {
  return (
    <AppShell brand="SAT Practice" caption="PARENT" roleLabel="Parent" userName={userName} avatarUrl={avatarUrl} items={resolveLinks(PARENT_NAV, { role: "PARENT", flags: {} })}>
      {children}
    </AppShell>
  );
}
