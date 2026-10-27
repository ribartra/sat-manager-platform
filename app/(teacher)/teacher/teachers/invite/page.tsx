import { redirect } from "next/navigation";
import { PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireTeacherManager } from "@/lib/rbac";
import { InviteTeacherForm } from "./invite-teacher-form";

export const dynamic = "force-dynamic";

/** Invite a teacher (master teacher only). The teacher gets an email link and their own program. */
export default async function InviteTeacherPage() {
  const session = await requireTeacherManager();
  if (!session) redirect("/teacher");
  return (
    <PageShell maxWidth={720}>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Teachers", href: "/teacher/teachers" }, { label: "Invite teacher" }]} />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Invite a teacher</h1>
      <p className="mb-5 mt-0.5 text-sm text-gray-500">
        They get an email to create their password. Then they can invite and follow their own students; you will see who their students are, not their work.
      </p>
      <InviteTeacherForm />
    </PageShell>
  );
}
