import Link from "next/link";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { FileReviewClient } from "./review-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ batchId: string; fileId: string }>;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export default async function AiImportFileReviewPage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");

  const { batchId, fileId } = await params;
  const [batch, file, reviewSession, latestEvent] = await Promise.all([
    prisma.ingestBatch.findUnique({ where: { id: batchId } }),
    prisma.ingestSourceFile.findFirst({ where: { id: fileId, batchId } }),
    prisma.ingestReviewSession.upsert({
      where: { batchId },
      create: {
        id: `review_${randomUUID().replace(/-/g, "")}`,
        batchId,
        sourceFileId: fileId,
        currentStep: "QUESTIONS",
        status: "IN_PROGRESS",
      },
      update: { sourceFileId: fileId, currentStep: "QUESTIONS" },
    }),
    prisma.ingestJobEvent.findFirst({
      where: { batchId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!batch || !file) redirect("/admin/import/ai");

  const [pages, candidates, answers, images, incidents] = await Promise.all([
    prisma.ingestPageArtifact.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: { pageNumber: "asc" },
    }),
    prisma.ingestQuestionCandidate.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: [{ questionNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.ingestAnswerCandidate.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: [{ questionNumber: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
    prisma.ingestImageArtifact.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: [{ pageNumber: "asc" }, { imageIndex: "asc" }],
      take: 300,
    }),
    prisma.ingestIncident.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const candidateLinks = candidates.length
    ? await prisma.ingestCandidateImageLink.findMany({
        where: { batchId, candidateId: { in: candidates.map((candidate) => candidate.id) } },
        orderBy: [{ candidateId: "asc" }, { sortOrder: "asc" }],
      })
    : [];
  const estimatedPages = pages.length || file.pageCount || 0;
  const secondsPerPage = latestEvent?.secondsPerPage && latestEvent.secondsPerPage > 0 ? latestEvent.secondsPerPage : 60;
  const estimatedSeconds = Math.ceil(estimatedPages * secondsPerPage);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href={`/admin/import/ai?batch=${batchId}`} className="text-sm text-blue-600 hover:underline">
            Back to batch
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Review File</h1>
          <p className="mt-1 text-sm text-gray-500">{file.relativePath}</p>
        </div>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Estimated processing time</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{formatDuration(estimatedSeconds)}</p>
          <p className="mt-1 text-xs text-gray-500">{estimatedPages} pages · {secondsPerPage.toFixed(1)} sec/page</p>
        </Card>
      </div>

      <FileReviewClient
        batchId={batchId}
        file={{
          id: file.id,
          relativePath: file.relativePath,
          contentType: file.contentType,
          sourceKind: file.sourceKind,
          section: file.section,
          topicName: file.topicName,
          difficulty: file.difficulty,
          status: file.status,
        }}
        reviewSession={{ currentStep: reviewSession.currentStep, status: reviewSession.status }}
        pages={pages.map((page) => ({
          id: page.id,
          pageNumber: page.pageNumber,
          method: page.method,
          extractedText: page.extractedText,
          warning: page.warning,
        }))}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          questionNumber: candidate.questionNumber,
          questionExternalId: candidate.questionExternalId,
          moduleLabel: candidate.moduleLabel,
          section: candidate.section,
          domainName: candidate.domainName,
          topicName: candidate.topicName,
          subskillName: candidate.subskillName,
          difficulty: candidate.difficulty,
          type: candidate.type,
          stem: candidate.stem,
          stimulus: candidate.stimulus,
          optionsJson: candidate.optionsJson,
          correctAnswer: candidate.correctAnswer,
          explanation: candidate.explanation,
          confidence: candidate.confidence,
          status: candidate.status,
          officialQuestionId: candidate.officialQuestionId,
          promotionStatus: candidate.promotionStatus,
          warningsJson: candidate.warningsJson,
        }))}
        answers={answers.map((answer) => ({
          id: answer.id,
          questionNumber: answer.questionNumber,
          answer: answer.answer,
          explanation: answer.explanation,
          confidence: answer.confidence,
        }))}
        images={images.map((image) => ({
          id: image.id,
          pageArtifactId: image.pageArtifactId,
          pageNumber: image.pageNumber,
          imageIndex: image.imageIndex,
          origin: image.origin,
          fileUrl: image.fileUrl,
          base64Data: image.base64Data,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          status: image.status,
        }))}
        imageLinks={candidateLinks.map((link) => ({
          id: link.id,
          candidateId: link.candidateId,
          imageArtifactId: link.imageArtifactId,
          targetType: link.targetType,
          optionLabel: link.optionLabel,
          sortOrder: link.sortOrder,
        }))}
        incidents={incidents.map((incident) => ({
          id: incident.id,
          severity: incident.severity,
          code: incident.code,
          message: incident.message,
          status: incident.status,
          decision: incident.decision,
          action: incident.action,
        }))}
      />
    </div>
  );
}
