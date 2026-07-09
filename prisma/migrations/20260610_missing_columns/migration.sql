-- User: add avatarUrl and birthDate
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;

-- Program: add soft-delete field
ALTER TABLE "Program" ADD COLUMN "deletedAt" DATETIME;

-- ProgramEnrollment: add parental consent fields
ALTER TABLE "ProgramEnrollment" ADD COLUMN "parentApprovalStatus" TEXT;
ALTER TABLE "ProgramEnrollment" ADD COLUMN "parentApprovedAt" DATETIME;
