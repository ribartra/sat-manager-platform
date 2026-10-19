import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { computeExtractedTests } from "@/lib/ingest-sets.server";
import { SetsIndexClient } from "./sets-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ batch?: string }>;
}

// An "Extracted Test" is a computed staging group (source files + candidates):
// Practice Set key PRACTICE|… or Full Test section key FULL|N|RW|MATH.
// This page lists every Extracted Test in a batch with pending-question
// breakdown so a reviewer can filter and jump into per-file review + crop.
// Shared with the review rail via lib/ingest-sets.ts.

export default async function AiImportSetsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");

  const { batch: requestedBatchId } = await searchParams;
  const batches = await prisma.ingestBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const selectedBatchId = requestedBatchId ?? batches[0]?.id;

  if (!selectedBatchId) {
    return (
      <PageShell>
        <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "AI Import", href: "/admin/import/ai" }, { label: "Extracted Tests" }]} />
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Extracted Tests to review</h1>
        <p className="mt-2 text-sm text-gray-500">No ingest batches yet.</p>
        <Link href="/admin/import/ai" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Go to AI Import
        </Link>
      </PageShell>
    );
  }

  const rows = await computeExtractedTests(selectedBatchId);

  return (
    <SetsIndexClient
      rows={rows}
      batchId={selectedBatchId}
      batches={batches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
