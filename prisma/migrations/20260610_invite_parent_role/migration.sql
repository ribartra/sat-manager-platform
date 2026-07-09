-- Add role, isMinor, and linkedStudentEmail to InviteToken
ALTER TABLE "InviteToken" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "InviteToken" ADD COLUMN "isMinor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InviteToken" ADD COLUMN "linkedStudentEmail" TEXT;
