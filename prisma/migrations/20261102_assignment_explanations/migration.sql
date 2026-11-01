-- Explanations in the player decided per assignment (and recorded on each attempt), and the Test
-- number that groups the versions of one Test across sources ("TEST N"). ADD-only + backfill: no
-- table rebuild (the single-open-attempt partial indexes and the section triggers stay untouched).

ALTER TABLE "GroupAssignment" ADD COLUMN "showExplanations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Assignment" ADD COLUMN "showExplanations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FullPracticeTestAssignment" ADD COLUMN "showExplanations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Attempt" ADD COLUMN "showExplanations" BOOLEAN;
ALTER TABLE "FullPracticeTestAttempt" ADD COLUMN "showExplanations" BOOLEAN;
ALTER TABLE "FullPracticeTestAnswer" ADD COLUMN "checkedAt" DATETIME;
ALTER TABLE "FullPracticeTest" ADD COLUMN "number" INTEGER;
CREATE INDEX "FullPracticeTest_number_idx" ON "FullPracticeTest"("number");

-- Keep what students see today: Practice Sets showed explanations on Check, Tests had none.
UPDATE "FullPracticeTestAssignment" SET "showExplanations" = false;
UPDATE "Attempt" SET "showExplanations" = true;
UPDATE "FullPracticeTestAttempt" SET "showExplanations" = false;

-- "TEST N" names → number.
UPDATE "FullPracticeTest"
SET "number" = CAST(trim(substr("name", 6)) AS INTEGER)
WHERE upper("name") LIKE 'TEST %' AND trim(substr("name", 6)) <> '' AND trim(substr("name", 6)) NOT GLOB '*[^0-9]*';
