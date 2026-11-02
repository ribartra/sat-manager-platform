-- Classroom / Homework (pendiente-p2.md): a practice assignment has a context, and a student can have
-- one assignment of a set per context. Existing assignments become HOMEWORK (the column default), so
-- every current result keeps counting. Schema only: the default fills the column, no data statements.
-- The raw partial indexes (20261005_single_open_attempt, 20261105_…) and the practiceArea triggers are
-- untouched.
ALTER TABLE "Assignment" ADD COLUMN "context" TEXT NOT NULL DEFAULT 'HOMEWORK';

DROP INDEX "Assignment_studentId_practiceSetId_key";

CREATE UNIQUE INDEX "Assignment_studentId_practiceSetId_context_key" ON "Assignment"("studentId", "practiceSetId", "context");
