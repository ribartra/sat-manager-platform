-- RNF-13 consent version + birth date on invites; RNF-17 FPT attempt snapshot;
-- RNF-14 history rows (answers, pauses, enrollments, parent links, unlock requests) can no longer be cascade-deleted.
-- AlterTable
ALTER TABLE "InviteToken" ADD COLUMN "birthDate" DATETIME;
ALTER TABLE "InviteToken" ADD COLUMN "parentConsentVersion" TEXT;

-- AlterTable
ALTER TABLE "FullPracticeTestAttempt" ADD COLUMN "testSnapshot" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProgramEnrollment" (
    "programId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentApprovalStatus" TEXT,
    "parentApprovedAt" DATETIME,

    PRIMARY KEY ("programId", "studentId"),
    CONSTRAINT "ProgramEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProgramEnrollment" ("active", "enrolledAt", "parentApprovalStatus", "parentApprovedAt", "programId", "status", "studentId") SELECT "active", "enrolledAt", "parentApprovalStatus", "parentApprovedAt", "programId", "status", "studentId" FROM "ProgramEnrollment";
DROP TABLE "ProgramEnrollment";
ALTER TABLE "new_ProgramEnrollment" RENAME TO "ProgramEnrollment";
CREATE TABLE "new_AttemptPause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "pausedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" DATETIME,
    "durationSeconds" INTEGER,
    CONSTRAINT "AttemptPause_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AttemptPause" ("attemptId", "durationSeconds", "id", "pausedAt", "resumedAt") SELECT "attemptId", "durationSeconds", "id", "pausedAt", "resumedAt" FROM "AttemptPause";
DROP TABLE "AttemptPause";
ALTER TABLE "new_AttemptPause" RENAME TO "AttemptPause";
CREATE TABLE "new_AttemptAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionSnapshot" TEXT,
    "answer" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpent" INTEGER,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "eliminatedOptions" TEXT,
    "checkedAt" DATETIME,
    CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AttemptAnswer" ("answer", "attemptId", "checkedAt", "eliminatedOptions", "id", "isCorrect", "markedForReview", "note", "questionId", "questionSnapshot", "timeSpent") SELECT "answer", "attemptId", "checkedAt", "eliminatedOptions", "id", "isCorrect", "markedForReview", "note", "questionId", "questionSnapshot", "timeSpent" FROM "AttemptAnswer";
DROP TABLE "AttemptAnswer";
ALTER TABLE "new_AttemptAnswer" RENAME TO "AttemptAnswer";
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer"("attemptId", "questionId");
CREATE TABLE "new_UnlockRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "UnlockRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UnlockRequest" ("assignmentId", "createdAt", "id", "resolvedAt", "status", "studentId") SELECT "assignmentId", "createdAt", "id", "resolvedAt", "status", "studentId" FROM "UnlockRequest";
DROP TABLE "UnlockRequest";
ALTER TABLE "new_UnlockRequest" RENAME TO "UnlockRequest";
CREATE TABLE "new_ParentStudent" (
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorizedAt" DATETIME,

    PRIMARY KEY ("parentId", "studentId"),
    CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ParentStudent" ("authorizedAt", "parentId", "studentId") SELECT "authorizedAt", "parentId", "studentId" FROM "ParentStudent";
DROP TABLE "ParentStudent";
ALTER TABLE "new_ParentStudent" RENAME TO "ParentStudent";
CREATE TABLE "new_FullPracticeTestPause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "pausedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" DATETIME,
    "durationSeconds" INTEGER,
    CONSTRAINT "FullPracticeTestPause_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "FullPracticeTestAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FullPracticeTestPause" ("attemptId", "durationSeconds", "id", "pausedAt", "resumedAt") SELECT "attemptId", "durationSeconds", "id", "pausedAt", "resumedAt" FROM "FullPracticeTestPause";
DROP TABLE "FullPracticeTestPause";
ALTER TABLE "new_FullPracticeTestPause" RENAME TO "FullPracticeTestPause";
CREATE TABLE "new_FullPracticeTestAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpent" INTEGER,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "eliminatedOptions" TEXT,
    CONSTRAINT "FullPracticeTestAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "FullPracticeTestAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FullPracticeTestAnswer" ("answer", "attemptId", "eliminatedOptions", "id", "isCorrect", "markedForReview", "moduleId", "note", "questionId", "timeSpent") SELECT "answer", "attemptId", "eliminatedOptions", "id", "isCorrect", "markedForReview", "moduleId", "note", "questionId", "timeSpent" FROM "FullPracticeTestAnswer";
DROP TABLE "FullPracticeTestAnswer";
ALTER TABLE "new_FullPracticeTestAnswer" RENAME TO "FullPracticeTestAnswer";
CREATE INDEX "FullPracticeTestAnswer_questionId_idx" ON "FullPracticeTestAnswer"("questionId");
CREATE UNIQUE INDEX "FullPracticeTestAnswer_attemptId_questionId_key" ON "FullPracticeTestAnswer"("attemptId", "questionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

