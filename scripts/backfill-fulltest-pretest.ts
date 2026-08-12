/**
 * Mark FullPracticeTestQuestion.isPretest = (order < 2) for all modules.
 * Usage: MODE=APPLY npx tsx scripts/backfill-fulltest-pretest.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";

const APPLY = process.env.MODE === "APPLY";

async function main() {
  console.log(`MODE=${APPLY ? "APPLY" : "DRY"}`);
  const links = await prisma.fullPracticeTestQuestion.findMany({
    select: { moduleId: true, questionId: true, order: true, isPretest: true },
  });
  let would = 0;
  let updated = 0;
  for (const link of links) {
    const want = link.order < 2;
    if (link.isPretest === want) continue;
    would += 1;
    if (!APPLY) continue;
    await prisma.fullPracticeTestQuestion.update({
      where: { moduleId_questionId: { moduleId: link.moduleId, questionId: link.questionId } },
      data: { isPretest: want },
    });
    updated += 1;
  }
  console.log(`DONE would=${would} updated=${updated} total=${links.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
