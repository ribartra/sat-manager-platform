import prisma from "@/lib/prisma";
import { MaterialsClient } from "./materials-client";

export default async function TeacherMaterialsPage() {
  const [topics, materials] = await Promise.all([
    prisma.topic.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.studyMaterial.findMany({
      orderBy: { updatedAt: "desc" },
      include: { topic: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Study Materials</h1>
      <p className="mb-6 text-sm text-gray-500">Publish theory notes and support links for students.</p>
      <MaterialsClient topics={topics} materials={materials} />
    </div>
  );
}
