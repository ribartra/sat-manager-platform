import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { resolvePracticeArea } from "@/lib/practice-area";
import { compareSkills } from "@/lib/taxonomy-order";
import { DEFAULT_PRACTICE_SOURCE_ID, DEFAULT_TEST_SOURCE_ID } from "@/lib/content-source";
import { SourceDetailClient, type ContentRow } from "./source-detail-client";

/**
 * Source master (admin): one source, the Practice Sets and Tests associated with it, and a picker to
 * associate other content with it (or move its own content to another source).
 */
export default async function AdminSourcePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) redirect("/teacher");
  const { id } = await params;
  const [source, sources, sets, tests] = await Promise.all([
    prisma.source.findUnique({ where: { id } }),
    prisma.source.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, active: true, forPracticeSets: true, forTests: true } }),
    prisma.practiceSet.findMany({
      select: {
        id: true,
        name: true,
        difficulty: true,
        status: true,
        sourceId: true,
        topic: { select: { id: true, name: true, domain: { select: { name: true, practiceArea: true } } } },
      },
    }),
    prisma.fullPracticeTest.findMany({ select: { id: true, name: true, status: true, sourceId: true }, orderBy: { name: "asc" } }),
  ]);
  if (!source) notFound();
  const sourceName = new Map(sources.map((s) => [s.id, s.name]));

  // Sets without a source count as College Board and Tests as Innovator (the migration backfill).
  const setRows: ContentRow[] = [...sets]
    .sort((a, b) => compareSkills(a.topic, b.topic) || a.difficulty.localeCompare(b.difficulty) || a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((set) => {
      const sourceId = set.sourceId ?? DEFAULT_PRACTICE_SOURCE_ID;
      return {
        id: set.id,
        name: set.name,
        detail: `${set.topic.domain.name} · ${set.topic.name}`,
        area: resolvePracticeArea(set.topic.domain) ?? "",
        difficulty: set.difficulty,
        status: set.status,
        sourceId,
        sourceName: sourceName.get(sourceId) ?? "—",
      };
    });
  const testRows: ContentRow[] = tests
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((test) => {
      const sourceId = test.sourceId ?? DEFAULT_TEST_SOURCE_ID;
      return { id: test.id, name: test.name, detail: "Test", area: "", difficulty: null, status: test.status, sourceId, sourceName: sourceName.get(sourceId) ?? "—" };
    });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Sources", href: "/admin/sources" }, { label: source.name }]} />
      <SourceDetailClient
        source={{ id: source.id, name: source.name, active: source.active, forPracticeSets: source.forPracticeSets, forTests: source.forTests }}
        sources={sources}
        practiceSets={setRows}
        tests={testRows}
      />
    </PageShell>
  );
}
