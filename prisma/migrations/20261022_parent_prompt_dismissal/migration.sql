-- "Don't ask again" for linking a parent after emailing a report to an address. New table only.

-- CreateTable
CREATE TABLE "ParentLinkPromptDismissal" (
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "studentId"),
    CONSTRAINT "ParentLinkPromptDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentLinkPromptDismissal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ParentLinkPromptDismissal_studentId_idx" ON "ParentLinkPromptDismissal"("studentId");
