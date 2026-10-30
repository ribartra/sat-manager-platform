import { redirect } from "next/navigation";
import { StudentShell } from "@/components/nav-student";
import { auth } from "@/lib/auth";
import { homeHrefForRole } from "@/lib/nav-config";
import { loadShellProps } from "@/lib/shell-props";

export const dynamic = "force-dynamic";

/** Student portal. Other roles go to their own portal (the teacher's Student view is /teacher/impersonate). */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const shell = await loadShellProps(session);
  if (shell.role !== "STUDENT") redirect(homeHrefForRole(shell.role));
  return (
    <StudentShell userName={shell.userName} avatarUrl={shell.avatarUrl} hasActiveEnrollment={shell.hasActiveEnrollment} flags={shell.flags}>
      {children}
    </StudentShell>
  );
}
