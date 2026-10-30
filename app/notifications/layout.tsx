import { redirect } from "next/navigation";
import { ParentShell } from "@/components/nav-parent";
import { StudentShell } from "@/components/nav-student";
import { TeacherShell } from "@/components/nav-teacher";
import { auth } from "@/lib/auth";
import { loadShellProps } from "@/lib/shell-props";

export const dynamic = "force-dynamic";

/** Notifications inside each role's own chrome (the same menu as the rest of its portal). */
export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const shell = await loadShellProps(session);

  if (shell.role === "TEACHER" || shell.role === "ADMIN") {
    return (
      <TeacherShell userName={shell.userName} avatarUrl={shell.avatarUrl} role={shell.role} flags={shell.flags} capabilities={shell.capabilities}>
        {children}
      </TeacherShell>
    );
  }
  if (shell.role === "STUDENT") {
    return (
      <StudentShell userName={shell.userName} avatarUrl={shell.avatarUrl} hasActiveEnrollment={shell.hasActiveEnrollment} flags={shell.flags}>
        {children}
      </StudentShell>
    );
  }
  if (shell.role === "PARENT") {
    return (
      <ParentShell userName={shell.userName} avatarUrl={shell.avatarUrl}>
        {children}
      </ParentShell>
    );
  }
  redirect("/");
}
