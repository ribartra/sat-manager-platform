import { redirect } from "next/navigation";
import { StudentShell } from "@/components/nav-student";
import { auth } from "@/lib/auth";
import { homeHrefForRole } from "@/lib/nav-config";
import { loadShellProps } from "@/lib/shell-props";
import { getStudentViewer } from "@/lib/student-viewer";

export const dynamic = "force-dynamic";

/**
 * Student portal: the signed-in student, or a teacher / admin's Student view (started at
 * /teacher/impersonate/[id]: the student's own pages, tries simulated and nothing saved, until "Exit Student View").
 * Anyone else goes to their own portal.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const own = await loadShellProps(session);
  const viewer = own.role === "STUDENT" ? null : await getStudentViewer();
  if (own.role !== "STUDENT" && !viewer) redirect(homeHrefForRole(own.role));
  // Student view: the chrome (menu, name, enrollment) is the student's.
  const shell = viewer
    ? await loadShellProps({ ...session!, user: { ...session!.user, id: viewer.studentId, name: viewer.studentName, role: "STUDENT" } })
    : own;
  return (
    <StudentShell
      userName={shell.userName}
      avatarUrl={shell.avatarUrl}
      hasActiveEnrollment={shell.hasActiveEnrollment}
      flags={shell.flags}
      isImpersonated={Boolean(viewer)}
      viewerName={viewer ? own.userName : undefined}
    >
      {children}
    </StudentShell>
  );
}
