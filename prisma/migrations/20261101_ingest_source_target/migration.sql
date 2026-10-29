-- AI Import source + simple "Import with AI" (CSV made by an external AI): the batch keeps the content
-- Source it promotes to, its mode and its target. ADD-only (FastAPI init_db adds the same columns
-- defensively; no table rebuild).
ALTER TABLE "IngestBatch" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "IngestBatch" ADD COLUMN "importMode" TEXT;
ALTER TABLE "IngestBatch" ADD COLUMN "targetJson" TEXT;
ALTER TABLE "IngestBatch" ADD COLUMN "createdById" TEXT;
