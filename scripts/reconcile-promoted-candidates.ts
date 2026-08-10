/**
 * Reconcile edited-after-promotion ingest candidates into their official
 * questions.
 *
 * Background: promoting a candidate copies its content into an official
 * `Question`; there is no automatic re-sync, and `promote-questions` skips
 * candidates already marked PROMOTED. So any crop/OCR/answer fix a reviewer
 * makes AFTER promotion never reaches the live question. This tool finds that
 * drift and (optionally) repairs it, using the SAME guarded logic as the
 * in-app re-sync path (`reconcileOfficialUpdate` in lib/ingest-promotion.ts) so
 * the two can never diverge. It never degrades official data (only fills empty
 * fields, restores LaTeX the official stem lost, corrects answers, and replaces
 * option sets that are degraded / carry markdown-link junk).
 *
 * Usage:
 *   npm run reconcile:promoted                 # dry-run, edited-after only
 *   npm run reconcile:promoted -- --all        # dry-run, every promoted candidate
 *   npm run reconcile:promoted -- --apply --confirm-server-stopped
 *
 * WAL SAFETY: --apply writes to dev.db directly with better-sqlite3. dev.db is
 * in WAL mode and the Next dev server keeps it open; a concurrent external write
 * corrupts it. So --apply REFUSES to run unless you pass
 * --confirm-server-stopped AND have actually stopped the web/ingest containers.
 * The in-app path (`POST …/promote-questions` with { resync: true }) writes
 * through the app and needs NO shutdown — prefer it for one-offs.
 *
 * Note: image propagation (question/option images) is intentionally handled
 * ONLY by the in-app re-sync endpoint, which materializes private assets into
 * public/uploads. This script reconciles text fields, answers and option TEXT.
 */
import "dotenv/config";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { buildQuestionDraft, reconcileOfficialUpdate } from "@/lib/ingest-promotion";

type Args = { apply: boolean; all: boolean; confirmStopped: boolean; limit: number | null };

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, all: false, confirmStopped: false, limit: null };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--confirm-server-stopped") args.confirmStopped = true;
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice("--limit=".length)) || null;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.apply && !args.confirmStopped) {
    console.error(
      "\nRefusing to --apply: dev.db is WAL and an external write while the dev server\n" +
      "is running will corrupt it. Stop the containers first:\n" +
      "  docker compose stop web ingest-service\n" +
      "then re-run with --apply --confirm-server-stopped.\n" +
      "(Or, with the server up, apply via the app: POST /api/admin/ai-import/batches/<id>/promote-questions { resync: true }.)\n"
    );
    process.exit(2);
  }

  const topics = await prisma.topic.findMany({
    include: { domain: { include: { section: true } }, subskills: true },
    orderBy: { name: "asc" },
  });

  const candidates = await prisma.ingestQuestionCandidate.findMany({
    where: { promotionStatus: "PROMOTED", officialQuestionId: { not: null } },
    orderBy: [{ sourceFileId: "asc" }, { questionNumber: "asc" }],
  });

  type Planned = {
    candidateId: string;
    questionId: string;
    label: string;
    changed: string[];
    questionData: Record<string, unknown>;
    replaceOptions: { label: string; text: string; imageUrl: string | null }[] | null;
  };
  const planned: Planned[] = [];
  let scanned = 0;

  for (const candidate of candidates) {
    if (!args.all) {
      const editedAfter = candidate.promotedAt && candidate.updatedAt > candidate.promotedAt;
      if (!editedAfter) continue;
    }
    if (!candidate.officialQuestionId || !candidate.stem || !candidate.correctAnswer) continue;
    scanned++;

    const rawLinks = await prisma.ingestCandidateImageLink.findMany({
      where: { candidateId: candidate.id },
      orderBy: [{ targetType: "asc" }, { sortOrder: "asc" }],
    });
    const images = rawLinks.length
      ? await prisma.ingestImageArtifact.findMany({
          where: { id: { in: rawLinks.map((link) => link.imageArtifactId) } },
          select: { id: true, fileUrl: true, base64Data: true, mimeType: true },
        })
      : [];
    const imageById = new Map(images.map((image) => [image.id, image]));
    const imageLinks = rawLinks.map((link) => ({
      targetType: link.targetType,
      optionLabel: link.optionLabel,
      sortOrder: link.sortOrder,
      image: {
        fileUrl: imageById.get(link.imageArtifactId)?.fileUrl ?? null,
        base64Data: imageById.get(link.imageArtifactId)?.base64Data ?? null,
        mimeType: imageById.get(link.imageArtifactId)?.mimeType ?? null,
      },
    }));

    const draft = buildQuestionDraft({ candidate, topics, imageLinks });
    const official = await prisma.question.findUnique({
      where: { id: candidate.officialQuestionId },
      include: { options: { select: { label: true, text: true, imageUrl: true } } },
    });
    if (!official) continue;

    // Image fields are out of scope for this script (see header) → blank imageUrl
    // so the guard never proposes writing an unmaterialized private URL.
    const draftForReconcile = { ...draft, imageUrl: "" };
    const result = reconcileOfficialUpdate(draftForReconcile, {
      stem: official.stem,
      stimulus: official.stimulus,
      explanation: official.explanation,
      correctAnswer: official.correctAnswer,
      imageUrl: official.imageUrl,
      options: official.options,
    });
    if (result.changed.length === 0) continue;

    planned.push({
      candidateId: candidate.id,
      questionId: official.id,
      label: `${candidate.section ?? "?"} #${candidate.questionNumber ?? "?"}`,
      changed: result.changed,
      questionData: result.questionData,
      replaceOptions: result.replaceOptions,
    });
  }

  console.log(`Scanned ${scanned} ${args.all ? "promoted" : "edited-after-promotion"} candidates.`);
  console.log(`Divergences to reconcile: ${planned.length}`);
  const totals: Record<string, number> = {};
  for (const item of planned) for (const change of item.changed) totals[change] = (totals[change] ?? 0) + 1;
  console.log("By field:", JSON.stringify(totals));
  console.log("");
  for (const item of planned) {
    console.log(`${item.label}\t${item.changed.join(",")}\tq=${item.questionId.slice(0, 10)} cand=${item.candidateId.slice(0, 14)}`);
  }

  if (!args.apply) {
    console.log(`\nDry-run only. Re-run with --apply --confirm-server-stopped to write (server must be stopped),`);
    console.log(`or apply through the app with { resync: true } on the promote-questions endpoint (no shutdown needed).`);
    return;
  }

  console.log(`\nApplying ${planned.length} reconciliations...`);
  for (const item of planned) {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(item.questionData).length > 0) {
        await tx.question.update({ where: { id: item.questionId }, data: item.questionData });
      }
      if (item.replaceOptions) {
        await tx.questionOption.deleteMany({ where: { questionId: item.questionId } });
        await tx.questionOption.createMany({
          data: item.replaceOptions.map((option) => ({
            id: `opt_${crypto.randomUUID().replace(/-/g, "")}`,
            questionId: item.questionId,
            label: option.label,
            text: option.text,
            imageUrl: option.imageUrl,
          })),
        });
      }
    });
  }

  // Fold the WAL back into dev.db and verify, so a subsequent commit is consistent.
  const checkpoint = await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
  const integrity = await prisma.$queryRawUnsafe("PRAGMA integrity_check;");
  console.log("checkpoint:", JSON.stringify(checkpoint));
  console.log("integrity :", JSON.stringify(integrity));
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
