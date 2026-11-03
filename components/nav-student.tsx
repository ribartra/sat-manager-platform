"use client";

import { AppShell } from "@/components/app-shell";
import type { FeatureSettingKey } from "@/lib/app-settings";
import { resolveStudentNav } from "@/lib/nav-config";

interface StudentShellProps {
  userName: string;
  avatarUrl?: string | null;
  /** A teacher/admin's Student view (read only, across every student page until Exit). */
  isImpersonated?: boolean;
  /** Who is looking (the teacher), in the Student view banner. */
  viewerName?: string;
  hasActiveEnrollment?: boolean;
  /** Platform feature flags (UI visibility only — not authorization). */
  flags?: Partial<Record<FeatureSettingKey, boolean>>;
  children: React.ReactNode;
}

/** Student chrome: left sidebar Home · Tests · Practice · History (mockup `mejorada`), collapsible. */
export function StudentShell({ userName, avatarUrl, isImpersonated, viewerName, hasActiveEnrollment = true, flags, children }: StudentShellProps) {
  const items = resolveStudentNav({ hasActiveEnrollment, flags: { MATERIALS_MODULE: flags?.MATERIALS_MODULE ?? false } });
  const banner = (
    <>
      {isImpersonated ? (
        <div role="status" className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>
            <span className="font-medium">Student view:</span> you are viewing as <strong>{userName}</strong> · read only
            {viewerName ? <span className="text-amber-700"> · signed in as {viewerName}</span> : null}
          </span>
          {/* A plain link: the route clears the Student view and goes back to the student's teacher page. */}
          <a href="/api/student-view/exit" className="font-medium underline">Exit Student View</a>
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
    <AppShell brand="SAT Practice" roleLabel={isImpersonated ? "Student view" : "Student"} userName={userName} avatarUrl={avatarUrl} items={items} collapsible banner={banner} studentView={isImpersonated}>
      {children}
    </AppShell>
  );
}
