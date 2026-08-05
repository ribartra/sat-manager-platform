-- Add parent-report sharing metadata to ParentAccessToken.
-- parentId: associated parent the report link was shared with.
-- areas:    CSV of report areas included (mathematics,reading,writing).
ALTER TABLE "ParentAccessToken" ADD COLUMN "parentId" TEXT;
ALTER TABLE "ParentAccessToken" ADD COLUMN "areas" TEXT;
