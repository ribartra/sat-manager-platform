-- Program as tenant. Hand-written: ADD COLUMN only (no table rebuild), so the SQLite triggers
-- (20261018_practice_sections) and partial unique indexes (20261005_single_open_attempt) stay intact.
--  1) ProgramEnrollment.teacherId: the owner teacher (who invited the student). Within a shared
--     program each teacher sees and manages only the students they own.
--  2) programId on the bank (Question, PracticeSet, FullPracticeTest, StudyMaterial): the bank of a
--     program is shared by its teachers. Existing content belongs to SAT Core Program.

-- The default program must exist (production databases built from the schema have no program rows).
INSERT OR IGNORE INTO "Program" ("id", "name", "startDate", "active", "createdAt", "updatedAt")
VALUES ('program-sat-core', 'SAT Core Program', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 1) Enrollment owner
ALTER TABLE "ProgramEnrollment" ADD COLUMN "teacherId" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ProgramEnrollment_teacherId_idx" ON "ProgramEnrollment"("teacherId");

-- Owner = the teacher who sent the student's (used) invitation...
UPDATE "ProgramEnrollment" SET "teacherId" = (
  SELECT "it"."invitedById" FROM "InviteToken" "it"
  JOIN "User" "inviter" ON "inviter"."id" = "it"."invitedById" AND "inviter"."role" = 'TEACHER'
  JOIN "User" "st" ON "st"."email" = "it"."email"
  WHERE "st"."id" = "ProgramEnrollment"."studentId" AND "it"."role" = 'STUDENT' AND "it"."usedAt" IS NOT NULL
  ORDER BY "it"."usedAt" DESC LIMIT 1
) WHERE "teacherId" IS NULL;
-- ...otherwise the program's first current teacher.
UPDATE "ProgramEnrollment" SET "teacherId" = (
  SELECT "pt"."teacherId" FROM "ProgramTeacher" "pt"
  WHERE "pt"."programId" = "ProgramEnrollment"."programId" AND "pt"."endDate" IS NULL
  ORDER BY "pt"."startDate" ASC LIMIT 1
) WHERE "teacherId" IS NULL;

-- 2) Bank per program
ALTER TABLE "Question" ADD COLUMN "programId" TEXT REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticeSet" ADD COLUMN "programId" TEXT REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FullPracticeTest" ADD COLUMN "programId" TEXT REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudyMaterial" ADD COLUMN "programId" TEXT REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Question_programId_idx" ON "Question"("programId");
CREATE INDEX "PracticeSet_programId_idx" ON "PracticeSet"("programId");
CREATE INDEX "FullPracticeTest_programId_idx" ON "FullPracticeTest"("programId");
CREATE INDEX "StudyMaterial_programId_idx" ON "StudyMaterial"("programId");

UPDATE "Question" SET "programId" = 'program-sat-core' WHERE "programId" IS NULL;
UPDATE "PracticeSet" SET "programId" = 'program-sat-core' WHERE "programId" IS NULL;
UPDATE "FullPracticeTest" SET "programId" = 'program-sat-core' WHERE "programId" IS NULL;
UPDATE "StudyMaterial" SET "programId" = 'program-sat-core' WHERE "programId" IS NULL;
