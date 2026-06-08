import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavStudent } from "@/components/nav-student";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  // Teachers can also access student views (impersonation)
  const isImpersonated = session.user.role !== "STUDENT";

  return (
    <div className="min-h-screen flex flex-col">
      <NavStudent
        userName={session.user.name}
        isImpersonated={isImpersonated}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
