import prisma from "@/lib/prisma";
import Link from "next/link";
import { MathContent } from "@/components/math-content";

export default async function StudentMaterialsPage() {
  const materials = await prisma.studyMaterial.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    include: { topic: { include: { domain: { include: { section: true } } } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Study Materials</h1>
      <div className="space-y-4">
        {materials.map((material) => (
          <article key={material.id} className="rounded-lg border border-gray-200 bg-white p-5">
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
          </article>
        ))}
        {materials.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No study materials have been published yet.
          </div>
        )}
      </div>
    </div>
  );
}
