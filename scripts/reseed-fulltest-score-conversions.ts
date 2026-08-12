/**
 * Reseed FullPracticeTestScoreConversion to operative caps RW 0..50 / MATH 0..40.
 * WAL-safe: stop web first when writing.
 * MODE=APPLY npx tsx scripts/reseed-fulltest-score-conversions.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { OPERATIVE_RAW_MAX } from "@/lib/full-test-scoring";

const APPLY = process.env.MODE === "APPLY";

async function main() {
  console.log(`MODE=${APPLY ? "APPLY" : "DRY"}`);
  for (const section of ["RW", "MATH"] as const) {
    const maxRaw = OPERATIVE_RAW_MAX[section];
    console.log(`${section}: ensure 0..${maxRaw}`);
    if (!APPLY) continue;
    await prisma.fullPracticeTestScoreConversion.deleteMany({
      where: { section, rawCorrect: { gt: maxRaw } },
    });
    for (let rawCorrect = 0; rawCorrect <= maxRaw; rawCorrect += 1) {
      const score = Math.round((200 + (rawCorrect / maxRaw) * 600) / 10) * 10;
      await prisma.fullPracticeTestScoreConversion.upsert({
        where: { section_rawCorrect: { section, rawCorrect } },
        update: { score },
        create: { section, rawCorrect, score },
      });
    }
  }
  const counts = await prisma.fullPracticeTestScoreConversion.groupBy({
    by: ["section"],
    _count: true,
    _max: { rawCorrect: true },
  });
  console.log("counts", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
