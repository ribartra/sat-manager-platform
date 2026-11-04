import prisma from "@/lib/prisma";
import { regradeAllAttempts } from "@/lib/attempt-regrade";

/**
 * After data patches were applied (scripts/apply-data-patches.mjs sets AppSetting REGRADE_PENDING),
 * submitted attempts are graded again with the current answer keys (lib/attempt-regrade.ts), so a patch
 * that fixed a key also fixes the results. In the background: it never delays the server start or its
 * health check; the flag is cleared only after it finished (a failure retries on the next start).
 */
void (async () => {
  try {
    const flag = await prisma.appSetting.findUnique({ where: { key: "REGRADE_PENDING" } });
    if (!flag) return;
    const result = await regradeAllAttempts({ reason: `data patches ${flag.value}` });
    await prisma.appSetting.deleteMany({ where: { key: "REGRADE_PENDING", updatedAt: flag.updatedAt } });
    console.log(`[regrade] after data patches: ${result.changed.length} of ${result.checked} submitted attempts re-graded`);
  } catch (error) {
    console.error("[regrade] after data patches failed (flag kept, retried on next start)", error);
  }
})();
