-- Every open assignment has an open date (unlockAt): where none was chosen it is the date the
-- assignment was made (createdAt). UPDATE only, no table rebuild (the single-open-attempt partial
-- indexes and the section triggers stay).
-- A manually locked practice assignment with no scheduled date keeps NULL: it gets its open date when
-- the teacher unlocks it (a past unlockAt on a locked row would make the scheduled release open it).

UPDATE "Assignment" SET "unlockAt" = "createdAt" WHERE "unlockAt" IS NULL AND "locked" = false;
UPDATE "GroupAssignment" SET "unlockAt" = "createdAt" WHERE "unlockAt" IS NULL AND "locked" = false;
UPDATE "FullPracticeTestAssignment" SET "unlockAt" = "createdAt" WHERE "unlockAt" IS NULL;
