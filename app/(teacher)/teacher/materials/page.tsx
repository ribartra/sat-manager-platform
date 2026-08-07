import prisma from "@/lib/prisma";
import { MaterialsClient } from "./materials-client";

export default async function TeacherMaterialsPage() {
  const [topics, materials] = await Promise.all([
    prisma.topic.findMany({
      orderBy: { name: "asc" },
      include: { domain: { include: { section: true } } },
    }),
    prisma.studyMaterial.findMany({
      orderBy: { updatedAt: "desc" },
      include: { topic: { include: { domain: { include: { section: true } } } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Study Materials</h1>
      <p className="mb-6 text-sm text-gray-500">Publish theory notes and support links for students.</p>
      <MaterialsClient
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: t.domain.section.label,
          domainName: t.domain.name,
        }))}
        materials={materials.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          body: m.body,
          url: m.url,
          status: m.status,
          topicId: m.topicId,
          topic: m.topic
            ? { name: m.topic.name, domainName: m.topic.domain.name, sectionLabel: m.topic.domain.section.label }
            : null,
        }))}
      />
    </div>
  );
}
