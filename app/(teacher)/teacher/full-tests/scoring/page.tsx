import prisma from "@/lib/prisma";
import { ScoringClient } from "./scoring-client";

export default async function FullTestScoringPage() {
  const rows = await prisma.fullPracticeTestScoreConversion.findMany({
    orderBy: [{ section: "asc" }, { rawCorrect: "asc" }],
  });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Full Test Score Conversion</h1>
      <p className="mb-6 text-sm text-gray-500">Load rows as section,rawCorrect,score. Sections are RW and MATH.</p>
      <ScoringClient initialCsv={rows.map((r) => `${r.section},${r.rawCorrect},${r.score}`).join("\n")} />
    </div>
  );
}
