-- Preserve the exact content shown to a student for each submitted attempt.
ALTER TABLE "Attempt" ADD COLUMN "practiceSetSnapshot" TEXT;
ALTER TABLE "AttemptAnswer" ADD COLUMN "questionSnapshot" TEXT;
