import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertContentImporter } from "@/lib/rbac";
import { ApiError, withApiErrors } from "@/lib/api-error";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { loadQuickBatch } from "@/lib/quick-import.server";
import { buildCsvPrompt, buildImagePrompt, QUICK_IMPORT_COLUMNS, TEST_MODULES, testModuleIndex } from "@/lib/quick-import";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ batchId: string }> };

// GET /api/import/quick/[batchId]/artifacts — reprocess: zip with the original PDF(s), every page as
// PNG, the questions imported so far (candidates.csv) and the prompts (CSV + image recovery).
export const GET = withApiErrors(async function GET(_req: Request, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  const { target } = await loadQuickBatch(batchId, session.user);
  const candidates = await prisma.ingestQuestionCandidate.findMany({
    where: { batchId },
    orderBy: [{ section: "asc" }, { moduleLabel: "asc" }, { questionNumber: "asc" }],
  });
  const moduleOf = (c: (typeof candidates)[number]) => (target.kind === "FULL_PRACTICE_TEST" ? TEST_MODULES[testModuleIndex(c)] : null);
  const raw = (c: (typeof candidates)[number]) => {
    try {
      return JSON.parse(c.rawJson) as Record<string, string>;
    } catch {
      return {};
    }
  };
  const options = (c: (typeof candidates)[number]) => {
    try {
      return (JSON.parse(c.optionsJson ?? "[]") as Array<{ label: string; text: string }>).reduce<Record<string, string>>((map, o) => ({ ...map, [o.label]: o.text }), {});
    } catch {
      return {};
    }
  };
  const csv = toCsv([
    [...QUICK_IMPORT_COLUMNS],
    ...candidates.map((c) => {
      const o = options(c);
      const r = raw(c);
      return [c.questionNumber, moduleOf(c), c.domainName, c.topicName, c.difficulty, c.type, c.stimulus, c.stem, o.A, o.B, o.C, o.D, c.correctAnswer, c.explanation, r.figure || "NONE", r.figurePage, r.notes];
    }),
  ]);
  const flagged = candidates
    .map((c) => ({ number: c.questionNumber ?? 0, module: moduleOf(c), figure: (raw(c).figure || "NONE").toUpperCase(), page: raw(c).figurePage }))
    .filter((q) => q.figure !== "NONE")
    .map((q) => ({ ...q, figure: `${q.figure.toLowerCase()}${q.page ? ` (page ${q.page})` : ""}` }));

  const res = await fetch(ingestUrl(`/batches/${batchId}/artifacts.zip`), {
    method: "POST",
    headers: ingestAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ files: { "candidates.csv": csv, "PROMPT-images.md": buildImagePrompt(flagged), "PROMPT-csv.md": buildCsvPrompt(target) } }),
  });
  if (!res.ok) throw ApiError.fromStatus(res.status, "The import service could not build the zip.");
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="import-artifacts-${batchId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
