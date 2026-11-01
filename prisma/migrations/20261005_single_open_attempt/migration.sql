-- At most one open (IN_PROGRESS) attempt per assignment. Finished/invalidated attempts are history
-- and may repeat. Partial indexes are not expressible in schema.prisma: keep them when generating
-- future migrations (do not accept a DROP INDEX for these names).
CREATE UNIQUE INDEX "FullPracticeTestAttempt_one_open_per_assignment"
ON "FullPracticeTestAttempt"("assignmentId") WHERE "status" = 'IN_PROGRESS' AND "assignmentId" IS NOT NULL;

CREATE UNIQUE INDEX "Attempt_one_open_per_assignment"
ON "Attempt"("assignmentId") WHERE "status" = 'IN_PROGRESS' AND "assignmentId" IS NOT NULL;

-- Practice without an assignment (staff opening a set outside preview): one open attempt per student+set.
CREATE UNIQUE INDEX "Attempt_one_open_unassigned"
ON "Attempt"("studentId", "practiceSetId") WHERE "status" = 'IN_PROGRESS' AND "assignmentId" IS NULL;
