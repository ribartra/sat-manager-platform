"use client";

import { AppShell } from "@/components/app-shell";
import type { FeatureSettingKey } from "@/lib/app-settings";
import { resolveStudentNav } from "@/lib/nav-config";

interface StudentShellProps {
  userName: string;
  avatarUrl?: string | null;
  /** A teacher/admin looking at a student page. */
  isImpersonated?: boolean;
  hasActiveEnrollment?: boolean;
  /** Platform feature flags (UI visibility only — not authorization). */
  flags?: Partial<Record<FeatureSettingKey, boolean>>;
  children: React.ReactNode;
}

/** Student chrome: left sidebar Home · Tests · Practice · History (mockup `mejorada`), collapsible. */
export function StudentShell({ userName, avatarUrl, isImpersonated, hasActiveEnrollment = true, flags, children }: StudentShellProps) {
  const items = resolveStudentNav({ hasActiveEnrollment, flags: { MATERIALS_MODULE: flags?.MATERIALS_MODULE ?? false } });
  const banner = (
    <>
      {isImpersonated ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
          ⚠ You are viewing as: <strong>{userName}</strong>
        </div>
      ) : null}
      {!hasActiveEnrollment ? (
        <div className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-center text-xs text-blue-700">
          You are not enrolled in an active program yet. Your teacher or administrator must enroll you.
        </div>
      ) : null}
    </>
  );
  return (
    <AppShell brand="SAT Practice" roleLabel="Student" userName={userName} avatarUrl={avatarUrl} items={items} collapsible banner={banner}>
      {children}
    </AppShell>
  );
}
