import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true, validationStatus: true } });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");
  if (session.user.role !== "PARENT") redirect("/");
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white py-3">
        <div className="mx-auto flex max-w-[var(--sat-page-wide)] items-center justify-between px-4">
          <span className="text-sm font-semibold text-blue-700">SAT Parent Portal</span>
          <Link href="/notifications" className="text-sm text-gray-600 hover:text-blue-600">Notifications</Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
