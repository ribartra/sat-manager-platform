"use client";

import { AppShell } from "@/components/app-shell";
import type { FeatureSettingKey } from "@/lib/app-settings";
import { TEACHER_USER_MENU_LINKS, resolveLinks, resolveTeacherNav, type NavCapability } from "@/lib/nav-config";

interface TeacherShellProps {
  userName: string;
  avatarUrl?: string | null;
  role?: string;
  /** Platform feature flags (UI visibility only — not authorization). */
  flags?: Partial<Record<FeatureSettingKey, boolean>>;
  /** Per-account capabilities (e.g. "manageTeachers" for the master teacher); pages re-check them. */
  capabilities?: NavCapability[];
  children: React.ReactNode;
}

/** Teacher (and admin) chrome: left sidebar Home · Students · Tests · Practice · History (+ Admin for admins). */
export function TeacherShell({ userName, avatarUrl, role, flags = {}, capabilities = [], children }: TeacherShellProps) {
  const items = resolveTeacherNav({ role, flags, capabilities });
  const master = capabilities.includes("manageTeachers");
  const userMenuLinks = resolveLinks(TEACHER_USER_MENU_LINKS, { role, flags });
  return (
    <AppShell
      brand="SAT Platform"
      caption={role === "ADMIN" ? "ADMIN" : "TEACHER"}
      roleLabel={role === "ADMIN" ? "Admin" : master ? "Master teacher" : "Teacher"}
      // Teachers: open Classroom work of their students is finished when they sign out (asked first).
      finishClassroomOnSignOut={role === "TEACHER"}
      userName={userName}
      avatarUrl={avatarUrl}
      items={items}
      userMenuLinks={userMenuLinks}
    >
      {children}
    </AppShell>
  );
}
