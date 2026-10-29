-- Content source: where Practice Sets and Tests come from. Existing Practice Sets are College Board,
-- existing Tests are Innovator. ADD-only (no table rebuild: section triggers and the single-open-attempt
-- partial indexes stay untouched).

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");

-- AlterTable
ALTER TABLE "PracticeSet" ADD COLUMN "sourceId" TEXT REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FullPracticeTest" ADD COLUMN "sourceId" TEXT REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PracticeSet_sourceId_idx" ON "PracticeSet"("sourceId");
CREATE INDEX "FullPracticeTest_sourceId_idx" ON "FullPracticeTest"("sourceId");

-- Data: the two sources of today's content, and the backfill.
INSERT INTO "Source" ("id", "name", "active", "sortOrder") VALUES ('src_college_board', 'College Board', true, 1);
INSERT INTO "Source" ("id", "name", "active", "sortOrder") VALUES ('src_innovator', 'Innovator', true, 2);
UPDATE "PracticeSet" SET "sourceId" = 'src_college_board' WHERE "sourceId" IS NULL;
UPDATE "FullPracticeTest" SET "sourceId" = 'src_innovator' WHERE "sourceId" IS NULL;
