import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { computeConjuntos } from "@/lib/ingest-sets.server";
import { SetsIndexClient } from "./sets-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ batch?: string }>;
}

// A "conjunto" is one ingest source document (a Practice Set PDF, or a Full
// Practice Test section file). This page consolidates every conjunto in a
// batch with its pending-question breakdown so a reviewer can filter to the
// documents that still need work and jump straight into the per-file review +
// crop tool. Row computation is shared with the review rail via
// lib/ingest-sets.ts. See app/admin/import/ai/[batchId]/files/[fileId].

export default async function AiImportSetsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");

  const { batch: requestedBatchId } = await searchParams;
  const batches = await prisma.ingestBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const selectedBatchId = requestedBatchId ?? batches[0]?.id;

  if (!selectedBatchId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Conjuntos por revisar</h1>
        <p className="mt-2 text-sm text-gray-500">No hay lotes de ingesta todavía.</p>
        <Link href="/admin/import/ai" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Ir a AI Import
        </Link>
      </div>
    );
  }

  const rows = await computeConjuntos(selectedBatchId);

  return (
    <SetsIndexClient
      rows={rows}
      batchId={selectedBatchId}
      batches={batches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
