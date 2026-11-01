import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { FeatureSettingKey } from "@/lib/app-settings";
import { getFeatureFlagValues } from "@/lib/feature-flags";
import type { NavCapability } from "@/lib/nav-config";
import prisma from "@/lib/prisma";

export interface ShellProps {
  userName: string;
  avatarUrl: string | null;
  role: string;
  flags: Partial<Record<FeatureSettingKey, boolean>>;
  /** Per-account capabilities (the master teacher's "manageTeachers"); pages re-check them. */
  capabilities: NavCapability[];
  /** Student only: enrolled in an active program (else the menu is restricted to Programs). */
  hasActiveEnrollment: boolean;
}

/**
 * Everything a portal layout needs for its chrome, read the same way for every layout (teacher, admin,
 * notifications, student, parent) so a user sees the same menu on every page. Signed-out, inactive and
 * not-yet-approved accounts are sent away here.
 */
export async function loadShellProps(session: Session | null): Promise<ShellProps> {
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true, avatarUrl: true, canManageTeachers: true },
  });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");
  const role = session.user.role;
  const now = new Date();
  const [flags, enrollment] = await Promise.all([
    getFeatureFlagValues({ role, userId: session.user.id }),
    role === "STUDENT"
      ? prisma.programEnrollment.findFirst({
          where: {
            studentId: session.user.id,
            status: "APPROVED",
            active: true,
            program: { active: true, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gt: now } }] },
          },
          select: { studentId: true },
        })
      : Promise.resolve(null),
  ]);
  return {
    userName: session.user.name,
    avatarUrl: user.avatarUrl,
    role,
    flags,
    // Master teacher (Teachers menu): only TEACHER accounts with the flag (the SAT Teacher account).
    capabilities: role === "TEACHER" && user.canManageTeachers ? ["manageTeachers"] : [],
    hasActiveEnrollment: role !== "STUDENT" || Boolean(enrollment),
  };
}
