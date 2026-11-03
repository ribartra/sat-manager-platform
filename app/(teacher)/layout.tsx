import { redirect } from "next/navigation";
import { TeacherShell } from "@/components/nav-teacher";
import { auth } from "@/lib/auth";
import { homeHrefForRole } from "@/lib/nav-config";
import { loadShellProps } from "@/lib/shell-props";
import { currentStudentView } from "@/lib/student-viewer";

export const dynamic = "force-dynamic";

/** Teacher (and admin) portal; the menu comes from loadShellProps, as on every portal page. */
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const shell = await loadShellProps(session);
  if (!["TEACHER", "ADMIN"].includes(shell.role)) redirect(homeHrefForRole(shell.role));
  // Student view lasts until "Exit Student View": teacher pages send back to it.
  if (await currentStudentView(session)) redirect("/student");
  // Master teacher (Teachers menu): canManageTeachers → "manageTeachers" (lib/shell-props.ts).
  return (
    <TeacherShell userName={shell.userName} avatarUrl={shell.avatarUrl} role={shell.role} flags={shell.flags} capabilities={shell.capabilities}>
      {children}
    </TeacherShell>
  );
}
