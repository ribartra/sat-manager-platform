-- Program: add startDate and endDate, migrate contractEndsAt → endDate
ALTER TABLE "Program" ADD COLUMN "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Program" ADD COLUMN "endDate" DATETIME;
UPDATE "Program" SET "endDate" = "contractEndsAt";
ALTER TABLE "Program" DROP COLUMN "contractEndsAt";

-- ProgramEnrollment: add status column
ALTER TABLE "ProgramEnrollment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED';

-- ProgramTeacher: recreate table to rename assignedAt→startDate, add endDate, drop active
CREATE TABLE "ProgramTeacher_new" (
    "programId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate"   DATETIME,
    PRIMARY KEY ("programId", "teacherId"),
    CONSTRAINT "ProgramTeacher_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "ProgramTeacher_new" ("programId", "teacherId", "startDate")
    SELECT "programId", "teacherId", "assignedAt" FROM "ProgramTeacher";
DROP TABLE "ProgramTeacher";
ALTER TABLE "ProgramTeacher_new" RENAME TO "ProgramTeacher";
