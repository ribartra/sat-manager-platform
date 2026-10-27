-- Master teacher capability: an account flag that lets one teacher manage teachers (Teachers menu:
-- invite, deactivate, see which students each teacher has). Only the SAT Teacher account gets it.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "canManageTeachers" BOOLEAN NOT NULL DEFAULT false;

-- Data: the SAT Teacher account (teacher@sat.com) is the master teacher.
UPDATE "User" SET "canManageTeachers" = true WHERE "email" = 'teacher@sat.com' AND "role" = 'TEACHER';
