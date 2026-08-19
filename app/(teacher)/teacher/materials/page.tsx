import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { academicTopicWhere } from "@/lib/taxonomy";
import { MaterialsClient } from "./materials-client";
import { getFeatureSetting } from "@/lib/app-settings";

export default async function TeacherMaterialsPage() {
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) notFound();

  const [topics, materials] = await Promise.all([
    prisma.topic.findMany({
      where: academicTopicWhere,
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
