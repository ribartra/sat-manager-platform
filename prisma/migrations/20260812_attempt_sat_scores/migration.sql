-- Practice Set attempts: persist % + estimated SAT section score for temporal progress.
ALTER TABLE "Attempt" ADD COLUMN "scorePercent" INTEGER;
ALTER TABLE "Attempt" ADD COLUMN "scaledScore" INTEGER;
ALTER TABLE "Attempt" ADD COLUMN "scoreSection" TEXT;
