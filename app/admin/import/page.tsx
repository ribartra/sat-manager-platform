import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BulkImportClient } from "./bulk-import-client";
import { academicTopicWhere } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function BulkImportPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");

  const topics = await prisma.topic.findMany({
    where: academicTopicWhere,
    include: { domain: { include: { section: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <PageShell>
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Bulk Import Questions</h1>
      <p className="mb-6 text-sm text-gray-500">Paste CSV rows, preview the required topic IDs below, then import as draft or published questions.</p>
      <BulkImportClient
        topics={topics.map((t) => ({
          id: t.id,
          label: `${t.domain.section.label} / ${t.domain.name} / ${t.name}`,
        }))}
      />
    </PageShell>
  );
}
