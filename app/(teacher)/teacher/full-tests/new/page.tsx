import prisma from "@/lib/prisma";
import { FullTestEditor } from "./full-test-editor-client";

export default async function NewFullTestPage() {
  const questions = await prisma.question.findMany({
    where: { status: "PUBLISHED" },
    include: { topic: { include: { domain: { include: { section: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New Full Practice Test</h1>
      <FullTestEditor
        questions={questions.map((q) => ({
          id: q.id,
          label: `${q.topic.domain.section.name === "MATH" ? "MATH" : "RW"} · ${q.difficulty} · ${q.stem.slice(0, 100)}`,
          section: q.topic.domain.section.name === "MATH" ? "MATH" : "RW",
        }))}
      />
    </div>
  );
}
