ALTER TABLE "QuestionOption" ADD COLUMN "imageUrl" TEXT;

CREATE TABLE "AttemptPause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "pausedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" DATETIME,
    "durationSeconds" INTEGER,
    CONSTRAINT "AttemptPause_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FullPracticeTestPause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "pausedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" DATETIME,
    "durationSeconds" INTEGER,
    CONSTRAINT "FullPracticeTestPause_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "FullPracticeTestAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ParentAccessToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParentAccessToken_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentAccessToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ParentAccessToken_tokenHash_key" ON "ParentAccessToken"("tokenHash");

CREATE TABLE "GroupAssignment" (
    "groupId" TEXT NOT NULL,
    "practiceSetId" TEXT NOT NULL,
    "assignedById" TEXT,
    "dueDate" DATETIME,
    "unlockAt" DATETIME,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("groupId", "practiceSetId"),
    CONSTRAINT "GroupAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupAssignment_practiceSetId_fkey" FOREIGN KEY ("practiceSetId") REFERENCES "PracticeSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
