CREATE TABLE "IngestJobEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "pageArtifactId" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'PROCESS',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "message" TEXT NOT NULL,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "processedPages" INTEGER NOT NULL DEFAULT 0,
    "totalFilesKnown" INTEGER NOT NULL DEFAULT 0,
    "totalPagesKnown" INTEGER NOT NULL DEFAULT 0,
    "estimatedRemainingPages" REAL NOT NULL DEFAULT 0,
    "estimatedSecondsRemaining" INTEGER NOT NULL DEFAULT 0,
    "secondsPerPage" REAL NOT NULL DEFAULT 60,
    "avgPagesPerFile" REAL NOT NULL DEFAULT 0,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "IngestJobEvent_batchId_idx" ON "IngestJobEvent"("batchId");
CREATE INDEX "IngestJobEvent_sourceFileId_idx" ON "IngestJobEvent"("sourceFileId");
CREATE INDEX "IngestJobEvent_jobType_idx" ON "IngestJobEvent"("jobType");
CREATE INDEX "IngestJobEvent_status_idx" ON "IngestJobEvent"("status");
