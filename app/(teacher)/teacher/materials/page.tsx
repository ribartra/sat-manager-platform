import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { currentContentScope } from "@/lib/content-scope";
import { PageHeader, PageShell } from "@/components/sat";
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
      // The materials of the programs the teacher teaches (shared bank).
      where: await currentContentScope(),
      orderBy: { updatedAt: "desc" },
      include: { topic: { include: { domain: { include: { section: true } } } } },
    }),
  ]);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: "/teacher/practice-sets" }, { label: "Materials" }]} />
      <PageHeader title="Study Materials" description="Publish theory notes and support links for students." />
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
