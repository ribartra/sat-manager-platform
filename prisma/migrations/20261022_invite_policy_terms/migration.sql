-- Invitation policy: one open invitation per student (revokedAt frees the slot) and consent recorded
-- as acceptance of the Terms of Use at activation. Adds columns only.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "InviteToken" ADD COLUMN "revokedAt" DATETIME;
ALTER TABLE "InviteToken" ADD COLUMN "termsAcceptedAt" DATETIME;
ALTER TABLE "InviteToken" ADD COLUMN "termsVersion" TEXT;
