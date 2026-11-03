import { redirect } from "next/navigation";
import { TeacherShell } from "@/components/nav-teacher";
import { auth } from "@/lib/auth";
import { homeHrefForRole } from "@/lib/nav-config";
import { loadShellProps } from "@/lib/shell-props";
import { currentStudentView } from "@/lib/student-viewer";

export const dynamic = "force-dynamic";

/** Admin pages: the teacher chrome (admin inherits it), with the same menu as the teacher pages. */
export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const shell = await loadShellProps(session);
  if (!["TEACHER", "ADMIN"].includes(shell.role)) redirect(homeHrefForRole(shell.role));
  // Student view lasts until "Exit Student View": admin pages send back to it.
  if (await currentStudentView(session)) redirect("/student");
  return (
    <TeacherShell userName={shell.userName} avatarUrl={shell.avatarUrl} role={shell.role} flags={shell.flags} capabilities={shell.capabilities}>
      {children}
    </TeacherShell>
  );
}
