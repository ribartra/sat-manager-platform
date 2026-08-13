/**
 * Backfill Full Practice Test questions: skill M1/M2 + difficulty EASY/HARD by module.
 *
 * Usage (WAL-safe):
 *   docker compose stop web
 *   docker compose run --rm -e MODE=APPLY web npx tsx scripts/backfill-fulltest-module-skills.ts
 *   # or from host with DATABASE_URL pointing at the same SQLite file after stop
 *   MODE=APPLY npx tsx scripts/backfill-fulltest-module-skills.ts
 *
 * Dry-run (default): MODE unset or MODE=DRY
 *
 * Prerequisite: node scripts/ensure-fulltest-topics.mjs (creates M1/M2 topics).
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import {
  difficultyFromFullTestModuleKey,
  fullTestTopicIdFor,
  moduleKeyFromOrder,
  type FullTestSection,
} from "@/lib/full-test-modules";

const APPLY = process.env.MODE === "APPLY";

async function main() {
  console.log(`MODE=${APPLY ? "APPLY" : "DRY"}`);

  const requiredTopics = [
    "top-fulltest-math-m1",
    "top-fulltest-math-m2",
    "top-fulltest-rw-m1",
    "top-fulltest-rw-m2",
  ];
  const existing = await prisma.topic.findMany({ where: { id: { in: requiredTopics } }, select: { id: true, name: true } });
  const have = new Set(existing.map((t) => t.id));
  const missing = requiredTopics.filter((id) => !have.has(id));
  if (missing.length) {
    console.error(`Missing topics: ${missing.join(", ")}. Run: node scripts/ensure-fulltest-topics.mjs`);
    process.exit(1);
  }

  const tests = await prisma.fullPracticeTest.findMany({
    where: {
      OR: [{ name: { startsWith: "TEST " } }, { name: { startsWith: "Imported Test" } }],
    },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { questions: { select: { questionId: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  let wouldUpdate = 0;
  let updated = 0;
  let candidatesAligned = 0;

  for (const test of tests) {
    console.log(`\n=== ${test.name} (${test.id}) ===`);
    for (const mod of test.modules) {
      const moduleKey = moduleKeyFromOrder(mod.order);
      const section: FullTestSection = mod.section === "MATH" || mod.order >= 2 ? "MATH" : "RW";
      const topicId = fullTestTopicIdFor(section, moduleKey);
      const difficulty = difficultyFromFullTestModuleKey(moduleKey);
      const ids = mod.questions.map((q) => q.questionId);
      console.log(`  order=${mod.order} ${mod.name} → skill=${moduleKey} difficulty=${difficulty} n=${ids.length}`);

      if (ids.length === 0) continue;

      const current = await prisma.question.findMany({
        where: { id: { in: ids } },
        select: { id: true, topicId: true, difficulty: true },
      });
      const toFix = current.filter((q) => q.topicId !== topicId || q.difficulty !== difficulty);
      wouldUpdate += toFix.length;

      if (!APPLY) {
        console.log(`    WOULD update ${toFix.length}/${ids.length} questions`);
        continue;
      }

      const result = await prisma.question.updateMany({
        where: { id: { in: ids } },
        data: { topicId, difficulty },
      });
      updated += result.count;
      console.log(`    OK updated ${result.count}`);

      const cands = await prisma.ingestQuestionCandidate.findMany({
        where: { officialQuestionId: { in: ids } },
        select: { id: true },
      });
      if (cands.length) {
        const cResult = await prisma.ingestQuestionCandidate.updateMany({
          where: { id: { in: cands.map((c) => c.id) } },
          data: { difficulty, topicName: moduleKey, updatedAt: new Date() },
        });
        candidatesAligned += cResult.count;
      }
    }
  }

  console.log(`\nDONE wouldUpdate=${wouldUpdate} updated=${updated} candidatesAligned=${candidatesAligned}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
