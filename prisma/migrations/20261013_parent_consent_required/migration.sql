-- Teacher option "Require parent authorization" on student invites (and "Ask parent to authorize"
-- requests for existing students). Minors always require it; adults only when the teacher asks.
ALTER TABLE "InviteToken" ADD COLUMN "parentConsentRequired" BOOLEAN NOT NULL DEFAULT false;

-- Existing minor invites already required consent: keep them consistent.
UPDATE "InviteToken" SET "parentConsentRequired" = true WHERE "isMinor" = true AND "parentEmail" IS NOT NULL;
