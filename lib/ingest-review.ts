import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { figureWarningResolved, isIngestWarningInfo, parseIngestWarningsJson } from "@/lib/ingest-warnings";

/**
 * A figure attached to a question resolves its "Figure in …: crop it from the PDF in Review" warning
 * (Import with AI marks those questions NEEDS_REVIEW). Called after every way a figure gets linked —
 * the AI's images zip, a crop assigned in Review, a gallery image — and before a Draft is created, so
 * a question whose only reason was its figure becomes READY and goes into the Draft. AI notes and
 * other checks are kept (they still need a person). Returns how many candidates changed.
 */
export async function reconcileFigureReview(candidateIds: string[]): Promise<number> {
  const ids = [...new Set(candidateIds.filter(Boolean))];
  if (ids.length === 0) return 0;
  const [candidates, links] = await Promise.all([
    prisma.ingestQuestionCandidate.findMany({
      where: { id: { in: ids }, status: { notIn: ["REJECTED"] }, promotionStatus: { not: "PROMOTED" } },
      select: { id: true, status: true, warningsJson: true },
    }),
    prisma.ingestCandidateImageLink.findMany({ where: { candidateId: { in: ids } }, select: { candidateId: true, targetType: true } }),
  ]);
  let changed = 0;
  for (const candidate of candidates) {
    const warnings = parseIngestWarningsJson(candidate.warningsJson);
    const own = links.filter((link) => link.candidateId === candidate.id);
    const kept = warnings.filter((warning) => !figureWarningResolved(warning, own));
    if (kept.length === warnings.length) continue;
    const ready = candidate.status === "NEEDS_REVIEW" && kept.every((warning) => isIngestWarningInfo(warning));
    await withSqliteRetry(() =>
      prisma.ingestQuestionCandidate.update({
        where: { id: candidate.id },
        data: {
          warningsJson: kept.length ? JSON.stringify(kept) : null,
          // Same confidence the CSV route gives a READY row (app/api/import/quick/[batchId]/csv/route.ts).
          ...(ready ? { status: "READY", confidence: 0.9 } : {}),
        },
      }),
    );
    changed += 1;
  }
  return changed;
}
