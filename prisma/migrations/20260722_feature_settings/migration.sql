CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES
  ('STUDENT_UNLOCK_REQUESTS', 'false', CURRENT_TIMESTAMP),
  ('STUDENT_SELF_ENROLLMENT', 'false', CURRENT_TIMESTAMP),
  ('TEACHER_PROGRAM_MANAGEMENT', 'false', CURRENT_TIMESTAMP);

DELETE FROM "UnlockRequest"
WHERE "id" = '1e7d1e54-2bec-4a20-9359-c5a56944c444';

DELETE FROM "ProgramEnrollment"
WHERE "studentId" IN (
  SELECT "id" FROM "User"
  WHERE "email" IN ('student.enrollpending@sat.com', 'student.minor@sat.com', 'student.minor2@sat.com')
);

DELETE FROM "ParentStudent"
WHERE "studentId" IN (
  SELECT "id" FROM "User"
  WHERE "email" IN ('student.pending@sat.com', 'student.noenroll@sat.com', 'student.enrollpending@sat.com', 'student.minor@sat.com', 'student.minor2@sat.com')
)
OR "parentId" IN (
  SELECT "id" FROM "User"
  WHERE "email" IN ('parent.pending@sat.com', 'parent.minor@sat.com')
);

DELETE FROM "User"
WHERE "email" IN (
  'student.noenroll@sat.com',
  'student.enrollpending@sat.com',
  'student.minor@sat.com',
  'student.minor2@sat.com',
  'parent.pending@sat.com',
  'parent.minor@sat.com'
);
