import { PageShell } from "@/components/sat";
import { FullTestEditor } from "./full-test-editor-client";
import { findQuestionsWithOptionMediaAndSection } from "@/lib/question-list-media-query";

export default async function NewFullTestPage() {
  const questions = await findQuestionsWithOptionMediaAndSection({ status: "PUBLISHED" });

  return (
    <PageShell>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New test</h1>
      <FullTestEditor questions={questions} />
    </PageShell>
  );
}
