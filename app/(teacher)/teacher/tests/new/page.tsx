import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireContentImporter } from "@/lib/rbac";
import { currentContentScope } from "@/lib/content-scope";
import { PageShell } from "@/components/sat";
import { FullTestEditor } from "./full-test-editor-client";
import { findQuestionsWithOptionMediaAndSection } from "@/lib/question-list-media-query";
import { DEFAULT_TEST_SOURCE_ID, listSources } from "@/lib/content-source";

export default async function NewFullTestPage() {
  const [questions, sources] = await Promise.all([
    findQuestionsWithOptionMediaAndSection({ status: "PUBLISHED", ...(await currentContentScope()) }),
    listSources({ activeOnly: true, kind: "tests" }),
  ]);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests", href: "/teacher/tests" }, { label: "New test" }]} />
      <h1 className="mb-6 text-[26px] font-bold tracking-[-0.3px] text-gray-900">New test</h1>
      <FullTestEditor canImport={Boolean(await requireContentImporter())} questions={questions} sources={sources} initial={{ sourceId: sources.find((s) => s.id === DEFAULT_TEST_SOURCE_ID)?.id }} />
    </PageShell>
  );
}
