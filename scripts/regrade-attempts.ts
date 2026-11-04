/**
 * Re-grades every SUBMITTED attempt (practice and Test) against the current questions, with the same
 * logic the app runs after a key fix (lib/attempt-regrade.ts). Use it after a data patch that changes
 * answer keys, or to check that stored results match the current keys.
 *
 * Usage:
 *   npm run regrade                                   # dry-run: lists the attempts whose result would change
 *   npm run regrade -- --apply --confirm-server-stopped
 *
 * WAL SAFETY: --apply writes to the database directly; stop the dev server that has it open first.
 * In production, key changes go through data patches (the patch carries the re-graded values).
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { regradeAllAttempts } from "@/lib/attempt-regrade";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
if (apply && !argv.includes("--confirm-server-stopped")) {
  console.error("--apply writes to the database: stop the dev server, then pass --confirm-server-stopped.");
  process.exit(1);
}

async function main() {
  const result = await regradeAllAttempts({ dryRun: !apply, reason: "regrade script" });
  for (const change of result.changed) {
    console.log(`${change.kind}\t${change.attemptId}\t${change.studentId}\t${change.before} → ${change.after}`);
  }
  console.log(`[regrade] ${apply ? "re-graded" : "would re-grade"} ${result.changed.length} of ${result.checked} submitted attempts`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
