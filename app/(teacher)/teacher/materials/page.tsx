import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { academicTopicWhere } from "@/lib/taxonomy";
import { domainSectionLabel } from "@/lib/practice-area";
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
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: "/teacher/practice-sets" }, { label: "Materials" }]} />
      <h1 className="mb-2 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Study Materials</h1>
      <p className="mb-6 text-sm text-gray-500">Publish theory notes and support links for students.</p>
      <MaterialsClient
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: domainSectionLabel({ practiceArea: t.domain.practiceArea }),
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
            ? {
                name: m.topic.name,
                domainName: m.topic.domain.name,
                sectionLabel: domainSectionLabel({ practiceArea: m.topic.domain.practiceArea }),
              }
            : null,
        }))}
      />
    </PageShell>
  );
}
