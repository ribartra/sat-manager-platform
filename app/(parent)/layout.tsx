import { redirect } from "next/navigation";
import { ParentShell } from "@/components/nav-parent";
import { auth } from "@/lib/auth";
import { homeHrefForRole } from "@/lib/nav-config";
import { loadShellProps } from "@/lib/shell-props";

export const dynamic = "force-dynamic";

/** Parent portal: the same chrome as every portal (ParentShell on AppShell). */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const shell = await loadShellProps(session);
  if (shell.role !== "PARENT") redirect(homeHrefForRole(shell.role));
  return (
    <ParentShell userName={shell.userName} avatarUrl={shell.avatarUrl}>
      {children}
    </ParentShell>
  );
}
