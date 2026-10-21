-- Problem reports ↔ coding agent: who fixed a report (admin or agent), the fix note/link, the agent
-- ticket, and a per-report event timeline. Adds columns and one table only.

-- AlterTable
ALTER TABLE "IssueReport" ADD COLUMN "resolvedBySource" TEXT;
ALTER TABLE "IssueReport" ADD COLUMN "resolutionNote" TEXT;
ALTER TABLE "IssueReport" ADD COLUMN "resolutionRef" TEXT;
ALTER TABLE "IssueReport" ADD COLUMN "agentTicketId" TEXT;
ALTER TABLE "IssueReport" ADD COLUMN "agentSentAt" DATETIME;
ALTER TABLE "IssueReport" ADD COLUMN "agentError" TEXT;

-- CreateTable
CREATE TABLE "IssueReportEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "ref" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueReportEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IssueReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IssueReportEvent_reportId_createdAt_idx" ON "IssueReportEvent"("reportId", "createdAt");
