import { redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireTeacherManager } from "@/lib/rbac";
import { InviteTeacherForm } from "./invite-teacher-form";
import prisma from "@/lib/prisma";
import { teachingProgramWhere } from "@/lib/program-scope";

export const dynamic = "force-dynamic";

/** Invite a teacher (master teacher only). The teacher gets an email link and their own program. */
export default async function InviteTeacherPage() {
  const session = await requireTeacherManager();
  if (!session) redirect("/teacher");
  // The invited teacher joins one of the master's programs (shared bank; own students).
  const programs = await prisma.program.findMany({ where: teachingProgramWhere(session.user.id), select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Teachers", href: "/teacher/teachers" }, { label: "Invite teacher" }]} />
      <PageHeader
        title="Invite a teacher"
        description="They get an email to create their password and join your program: they share its question bank, sets and Tests, and invite and follow their own students. You will see who their students are, not their work."
      />
      <InviteTeacherForm programs={programs} />
    </PageShell>
  );
}
