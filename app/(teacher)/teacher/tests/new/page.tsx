import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import { FullTestEditor } from "./full-test-editor-client";
import { findQuestionsWithOptionMediaAndSection } from "@/lib/question-list-media-query";

export default async function NewFullTestPage() {
  const questions = await findQuestionsWithOptionMediaAndSection({ status: "PUBLISHED" });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests", href: "/teacher/tests" }, { label: "New test" }]} />
      <h1 className="mb-6 text-[26px] font-bold tracking-[-0.3px] text-gray-900">New test</h1>
      <FullTestEditor questions={questions} />
    </PageShell>
  );
}
