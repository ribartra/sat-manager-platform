import Link from "next/link";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeCropImageSources } from "@/lib/ingest-crop-source";
import { computeConjuntos } from "@/lib/ingest-sets.server";
import { ConjuntoRail } from "@/app/admin/import/ai/_components/conjunto-rail";
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
      // moduleLabel first so a full test's modules don't interleave (each module
      // restarts numbering at 1); practice sets have a null label and fall through.
      orderBy: [{ moduleLabel: "asc" }, { questionNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.ingestAnswerCandidate.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: [{ moduleLabel: "asc" }, { questionNumber: "asc" }, { createdAt: "asc" }],
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
  // Promoted questions of the matching full test — offered as targets when assigning
  // an extracted image to a question from the gallery (a full-test question source
  // often has images but no candidates, so there's no per-candidate board to use).
  let assignTargets: { questionId: string; label: string }[] = [];
  if (file.contentType === "FULL_PRACTICE_TEST" && file.testNumber != null) {
    const tests = await prisma.fullPracticeTest.findMany({ select: { id: true, name: true } });
    const match = tests.find((t) => {
      const m = t.name.match(/test\s*0*(\d+)/i);
      return m && Number(m[1]) === file.testNumber;
    });
    if (match) {
      const wantSection = file.section ? (file.section.toUpperCase().includes("MATH") ? "MATH" : "RW") : null;
      const ftqs = await prisma.fullPracticeTestQuestion.findMany({
        where: { module: { testId: match.id, ...(wantSection ? { section: wantSection } : {}) } },
        orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
        select: { order: true, questionId: true, module: { select: { name: true, section: true } } },
      });
      assignTargets = ftqs.map((r) => {
        const mod = r.module.name.replace(/Reading\s*&?\s*Writing\s*/i, "").replace(/Mathematics?\s*/i, "").trim() || r.module.section;
        return { questionId: r.questionId, label: `${mod} · Q${r.order + 1}` };
      });
    }
  }

  // Resolve which source to crop from — this file if it has renderable pages,
  // otherwise a sibling in the batch that does (e.g. Test 1 R&W images live in the
  // questions DOCX while the candidates come from the answers DOCX). Also load the
  // batch's conjunto rows for the navigation rail.
  const [cropImageSourceMap, setRows] = await Promise.all([
    computeCropImageSources(batchId),
    computeConjuntos(batchId),
  ]);
  const cropImageSource = cropImageSourceMap[file.id] ?? null;
  // The conjunto this file belongs to — shown as context so the reviewer sees
  // the whole set (question + answer + explanation files) and its completeness.
  const conjunto = setRows.find((row) => row.fileIds.includes(file.id)) ?? null;
  const ROLE_LABEL: Record<string, string> = { QUESTION: "Preguntas", ANSWER: "Respuestas", EXPLANATION: "Explicaciones", OTHER: "Otro" };

  const estimatedPages = pages.length || file.pageCount || 0;
  const secondsPerPage = latestEvent?.secondsPerPage && latestEvent.secondsPerPage > 0 ? latestEvent.secondsPerPage : 60;
  const estimatedSeconds = Math.ceil(estimatedPages * secondsPerPage);

  return (
    <div className="mx-auto grid max-w-[100rem] gap-6 px-4 py-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-4 lg:self-start">
        <ConjuntoRail rows={setRows} batchId={batchId} currentFileId={file.id} />
      </div>

      <div className="min-w-0 space-y-6">
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

      {conjunto && (
        <Card padding="md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase text-gray-400">Conjunto</p>
              <p className="truncate text-base font-semibold text-gray-900" title={conjunto.title}>{conjunto.title}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex h-2 w-40 overflow-hidden rounded-full bg-gray-100" title={`${conjunto.complete} completas · ${conjunto.atencion} atención · ${conjunto.revisar} revisar`}>
                {conjunto.complete > 0 && <span className="bg-emerald-500" style={{ width: `${(conjunto.complete / (conjunto.total || 1)) * 100}%` }} />}
                {conjunto.atencion > 0 && <span className="bg-amber-500" style={{ width: `${(conjunto.atencion / (conjunto.total || 1)) * 100}%` }} />}
                {conjunto.revisar > 0 && <span className="bg-rose-500" style={{ width: `${(conjunto.revisar / (conjunto.total || 1)) * 100}%` }} />}
              </span>
              <span className="text-xs text-gray-500">
                {conjunto.total} preguntas · <span className="text-rose-600">{conjunto.revisar} revisar</span> · <span className="text-amber-600">{conjunto.atencion} atención</span>
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {conjunto.files.map((f) => (
              <span
                key={f.id}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${f.id === file.id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-600"}`}
                title={`${ROLE_LABEL[f.role]} · ${f.nQ} preguntas · ${f.nA} respuestas`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${f.role === "QUESTION" ? "bg-blue-500" : f.role === "ANSWER" ? "bg-emerald-500" : f.role === "EXPLANATION" ? "bg-violet-500" : "bg-gray-300"}`} />
                <span className="font-medium">{ROLE_LABEL[f.role]}</span>
                <span className="truncate max-w-[16rem] text-gray-400">{f.name}</span>
              </span>
            ))}
          </div>
          <Link href={`/admin/import/ai/sets?batch=${batchId}`} className="mt-3 inline-block text-xs text-blue-600 hover:underline">
            Ver todos los conjuntos y el detalle por pregunta →
          </Link>
        </Card>
      )}

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
          extension: file.extension,
        }}
        reviewSession={{ currentStep: reviewSession.currentStep, status: reviewSession.status }}
        assignTargets={assignTargets}
        cropImageSource={cropImageSource}
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
          moduleLabel: answer.moduleLabel,
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
    </div>
  );
}
