import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { getFeatureSetting } from "@/lib/app-settings";

export default async function StudentMaterialsPage() {
  if (!(await getFeatureSetting("MATERIALS_MODULE"))) notFound();

  const materials = await prisma.studyMaterial.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    include: { topic: { include: { domain: { include: { section: true } } } } },
  });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Materials" }]} />
      <h1 className="mb-6 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Study materials</h1>
      <div className="space-y-4">
        {materials.map((material) => (
          <Card as="article" key={material.id} padding="md">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{material.title}</h2>
                <p className="text-xs text-gray-500">
                  {material.topic
                    ? `${material.topic.domain.section.label} · ${material.topic.domain.name} · ${material.topic.name}`
                    : "General"}
                </p>
              </div>
              {material.url && (
                <Link href={material.url} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Open
                </Link>
              )}
            </div>
            {material.description && <p className="mb-3 text-sm text-gray-600">{material.description}</p>}
            {material.body && <MathContent content={material.body} className="text-sm text-gray-800" />}
          </Card>
        ))}
        {materials.length === 0 && (
          <Card padding="lg" className="border-dashed text-center text-sm text-gray-500">
            There are no study materials yet.
          </Card>
        )}
      </div>
    </PageShell>
  );
}
