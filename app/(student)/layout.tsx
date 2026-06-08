import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavStudent } from "@/components/nav-student";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true, validationStatus: true } });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");

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
