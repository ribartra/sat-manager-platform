-- FPT SAT parity: break between RW and Math; pretest flag on module questions.
ALTER TABLE "FullPracticeTest" ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "FullPracticeTestQuestion" ADD COLUMN "isPretest" BOOLEAN NOT NULL DEFAULT 0;
