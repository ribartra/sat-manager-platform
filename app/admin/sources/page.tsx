import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageHeader, PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { SourcesClient } from "./sources-client";

export default async function AdminSourcesPage() {
  // The admin layout also lets teachers in (AI Import); sources are admin-only.
  if (!(await requireAdmin())) redirect("/teacher");
  const sources = await prisma.source.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, forPracticeSets: true, forTests: true, _count: { select: { practiceSets: true, fullPracticeTests: true } } },
  });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Sources" }]} />
      <PageHeader
        title="Sources"
        description={
          <>
            Where Practice Sets and Tests come from. Each set or test has one source; “Used for” sets where it can be chosen: Practice Sets (each opens per source in Practice › By skill) and/or Tests.
            A source in use can&apos;t be deleted — deactivate it to hide it from the editors.
          </>
        }
      />
      <SourcesClient
        sources={sources.map((s) => ({ id: s.id, name: s.name, active: s.active, forPracticeSets: s.forPracticeSets, forTests: s.forTests, practiceSets: s._count.practiceSets, tests: s._count.fullPracticeTests }))}
      />
    </PageShell>
  );
}
