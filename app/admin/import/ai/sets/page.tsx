import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SetsIndexClient, type SetRow } from "./sets-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ batch?: string }>;
}

// A "conjunto" is one ingest source document (a Practice Set PDF, or a Full
// Practice Test section file). This page consolidates every conjunto in a
// batch with its pending-question breakdown so a reviewer can filter to the
// documents that still need work and jump straight into the per-file review +
// crop tool. See app/admin/import/ai/[batchId]/files/[fileId].

function textOptionCount(optionsJson: string | null): number {
  if (!optionsJson) return 0;
  try {
    const parsed = JSON.parse(optionsJson);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((option) => typeof option?.text === "string" && option.text.trim()).length;
  } catch {
    return 0;
  }
}

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

  const [sources, candidates, imageLinks] = await Promise.all([
    prisma.ingestSourceFile.findMany({
      where: { batchId: selectedBatchId, contentType: { in: ["PRACTICE_SET", "FULL_PRACTICE_TEST"] } },
      select: {
        id: true,
        relativePath: true,
        contentType: true,
        section: true,
        topicName: true,
        difficulty: true,
        testNumber: true,
        status: true,
      },
    }),
    prisma.ingestQuestionCandidate.findMany({
      where: { batchId: selectedBatchId, contentType: { in: ["PRACTICE_SET", "FULL_PRACTICE_TEST"] } },
      select: { id: true, sourceFileId: true, type: true, correctAnswer: true, optionsJson: true, promotionStatus: true, status: true },
    }),
    prisma.ingestCandidateImageLink.findMany({
      where: { batchId: selectedBatchId },
      select: { candidateId: true, targetType: true, optionLabel: true },
    }),
  ]);

  // Per-candidate image coverage: an OPTION_BLOCK link resolves all four
  // options; individual OPTION links each cover one letter.
  const optionBlock = new Set<string>();
  const optionLetters = new Map<string, Set<string>>();
  for (const link of imageLinks) {
    if (link.targetType === "OPTION_BLOCK") {
      optionBlock.add(link.candidateId);
    } else if (link.targetType === "OPTION" && link.optionLabel) {
      const set = optionLetters.get(link.candidateId) ?? new Set<string>();
      set.add(link.optionLabel.toUpperCase());
      optionLetters.set(link.candidateId, set);
    }
  }

  const byFile = new Map<string, { total: number; sinResp: number; faltanOpt: number; promoted: number }>();
  for (const candidate of candidates) {
    if (!candidate.sourceFileId) continue;
    // Merged-away / rejected candidates no longer count toward the file.
    if (candidate.status === "REJECTED" || candidate.promotionStatus === "REJECTED") continue;
    const stat = byFile.get(candidate.sourceFileId) ?? { total: 0, sinResp: 0, faltanOpt: 0, promoted: 0 };
    stat.total += 1;
    if (candidate.promotionStatus === "PROMOTED") stat.promoted += 1;
    const optionsResolved =
      candidate.type === "NUMERIC" ||
      optionBlock.has(candidate.id) ||
      textOptionCount(candidate.optionsJson) + (optionLetters.get(candidate.id)?.size ?? 0) >= 4;
    if (!candidate.correctAnswer) {
      stat.sinResp += 1;
    } else if (!optionsResolved) {
      stat.faltanOpt += 1;
    }
    byFile.set(candidate.sourceFileId, stat);
  }

  const rows: SetRow[] = sources
    .map((source) => {
      const stat = byFile.get(source.id) ?? { total: 0, sinResp: 0, faltanOpt: 0, promoted: 0 };
      const pending = stat.sinResp + stat.faltanOpt;
      return {
        sourceFileId: source.id,
        batchId: selectedBatchId,
        relativePath: source.relativePath,
        title: source.topicName || source.relativePath.split("/").at(-1) || "Conjunto",
        contentType: source.contentType ?? "PRACTICE_SET",
        section: source.section,
        difficulty: source.difficulty,
        testNumber: source.testNumber,
        status: source.status,
        total: stat.total,
        answerable: stat.total - pending,
        pending,
        sinResp: stat.sinResp,
        faltanOpt: stat.faltanOpt,
        promoted: stat.promoted,
      };
    })
    .sort((a, b) => b.pending - a.pending || a.relativePath.localeCompare(b.relativePath));

  return (
    <SetsIndexClient
      rows={rows}
      batchId={selectedBatchId}
      batches={batches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
