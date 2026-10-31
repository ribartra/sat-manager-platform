-- At most one open pause per attempt and one PENDING unlock request per assignment, enforced by the
-- database (a double click or two tabs used to create two open pauses / two requests and two teacher
-- notifications). Partial unique indexes, like 20261005_single_open_attempt: not expressible in
-- schema.prisma — a generated migration that drops them is wrong, keep them.

-- Defensive clean-up so the indexes can be created: keep the newest open pause / pending request,
-- close (pause: resumed when it started, 0 s) or remove (duplicate request) the older ones.
UPDATE "AttemptPause" SET "resumedAt" = "pausedAt", "durationSeconds" = 0
WHERE "resumedAt" IS NULL AND EXISTS (
  SELECT 1 FROM "AttemptPause" p2
  WHERE p2."attemptId" = "AttemptPause"."attemptId" AND p2."resumedAt" IS NULL
    AND (p2."pausedAt" > "AttemptPause"."pausedAt" OR (p2."pausedAt" = "AttemptPause"."pausedAt" AND p2."id" > "AttemptPause"."id"))
);
UPDATE "FullPracticeTestPause" SET "resumedAt" = "pausedAt", "durationSeconds" = 0
WHERE "resumedAt" IS NULL AND EXISTS (
  SELECT 1 FROM "FullPracticeTestPause" p2
  WHERE p2."attemptId" = "FullPracticeTestPause"."attemptId" AND p2."resumedAt" IS NULL
    AND (p2."pausedAt" > "FullPracticeTestPause"."pausedAt" OR (p2."pausedAt" = "FullPracticeTestPause"."pausedAt" AND p2."id" > "FullPracticeTestPause"."id"))
);
DELETE FROM "UnlockRequest"
WHERE "status" = 'PENDING' AND EXISTS (
  SELECT 1 FROM "UnlockRequest" r2
  WHERE r2."assignmentId" = "UnlockRequest"."assignmentId" AND r2."status" = 'PENDING'
    AND (r2."createdAt" > "UnlockRequest"."createdAt" OR (r2."createdAt" = "UnlockRequest"."createdAt" AND r2."id" > "UnlockRequest"."id"))
);

CREATE UNIQUE INDEX "AttemptPause_one_open_per_attempt" ON "AttemptPause"("attemptId") WHERE "resumedAt" IS NULL;
CREATE UNIQUE INDEX "FullPracticeTestPause_one_open_per_attempt" ON "FullPracticeTestPause"("attemptId") WHERE "resumedAt" IS NULL;
CREATE UNIQUE INDEX "UnlockRequest_one_pending_per_assignment" ON "UnlockRequest"("assignmentId") WHERE "status" = 'PENDING';
