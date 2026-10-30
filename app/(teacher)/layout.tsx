import { redirect } from "next/navigation";
import { TeacherShell } from "@/components/nav-teacher";
import { auth } from "@/lib/auth";
import { homeHrefForRole } from "@/lib/nav-config";
import { loadShellProps } from "@/lib/shell-props";

export const dynamic = "force-dynamic";

/** Teacher (and admin) portal; the menu comes from loadShellProps, as on every portal page. */
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const shell = await loadShellProps(session);
  if (!["TEACHER", "ADMIN"].includes(shell.role)) redirect(homeHrefForRole(shell.role));
  // Master teacher (Teachers menu): canManageTeachers → "manageTeachers" (lib/shell-props.ts).
  return (
    <TeacherShell userName={shell.userName} avatarUrl={shell.avatarUrl} role={shell.role} flags={shell.flags} capabilities={shell.capabilities}>
      {children}
    </TeacherShell>
  );
}
