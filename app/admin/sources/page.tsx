import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { SourcesClient } from "./sources-client";

export default async function AdminSourcesPage() {
  // The admin layout also lets teachers in (AI Import); sources are admin-only.
  if (!(await requireAdmin())) redirect("/teacher");
  const sources = await prisma.source.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, _count: { select: { practiceSets: true, fullPracticeTests: true } } },
  });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Sources" }]} />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Sources</h1>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Where Practice Sets and Tests come from. Each set or test has one source; in Practice › By skill every active source is a row of each skill.
        A source in use can&apos;t be deleted — deactivate it to hide it from the editors.
      </p>
      <SourcesClient
        sources={sources.map((s) => ({ id: s.id, name: s.name, active: s.active, practiceSets: s._count.practiceSets, tests: s._count.fullPracticeTests }))}
      />
    </PageShell>
  );
}
