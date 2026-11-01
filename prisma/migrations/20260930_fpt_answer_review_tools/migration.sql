-- Mark for review, personal notes and eliminated choices in Full Practice Tests (RF-26/27),
-- mirroring AttemptAnswer. eliminatedOptions stores a JSON array of option labels.
ALTER TABLE "FullPracticeTestAnswer" ADD COLUMN "markedForReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FullPracticeTestAnswer" ADD COLUMN "note" TEXT;
ALTER TABLE "FullPracticeTestAnswer" ADD COLUMN "eliminatedOptions" TEXT;
