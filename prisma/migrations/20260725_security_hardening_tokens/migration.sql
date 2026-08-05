ALTER TABLE "InviteToken" ADD COLUMN "parentConsentTokenHash" TEXT;
ALTER TABLE "InviteToken" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "PasswordResetToken" ADD COLUMN "tokenHash" TEXT;

CREATE UNIQUE INDEX "InviteToken_parentConsentTokenHash_key" ON "InviteToken"("parentConsentTokenHash");
CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
