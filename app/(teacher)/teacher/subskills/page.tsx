import prisma from "@/lib/prisma";
import { SubskillsClient } from "./subskills-client";

export default async function SubskillsPage() {
  const topics = await prisma.topic.findMany({
    include: { domain: { include: { section: true } }, subskills: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Subskills</h1>
      <SubskillsClient
        topics={topics.map((topic) => ({
          id: topic.id,
          label: `${topic.domain.section.label} / ${topic.domain.name} / ${topic.name}`,
          subskills: topic.subskills.map((s) => ({ id: s.id, name: s.name })),
        }))}
      />
    </div>
  );
}
