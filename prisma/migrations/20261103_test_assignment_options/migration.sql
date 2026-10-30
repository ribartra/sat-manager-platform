-- Tests get the same assignment options as practice sets: open date and when to show answers.
-- ADD-only: no table rebuild (the single-open-attempt partial indexes and section triggers stay).

ALTER TABLE "FullPracticeTestAssignment" ADD COLUMN "unlockAt" DATETIME;
ALTER TABLE "FullPracticeTestAssignment" ADD COLUMN "feedbackMode" TEXT NOT NULL DEFAULT 'AFTER_SET';

-- Keep what students see today: a Test with explanations on had the Check button per question.
UPDATE "FullPracticeTestAssignment" SET "feedbackMode" = 'IMMEDIATE' WHERE "showExplanations" = true;
