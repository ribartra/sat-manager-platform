-- QA teacher for production checks (email flows, 2026-11-01): qa.teacher@satsol.org, teacher of
-- SAT Core Program, not master. Only the bcrypt hash is here; the password is in .secrets/qa-prod.env
-- (gitignored). Guards: the email doesn't exist yet; the program link only for that new user.
-- expect: 2
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "active", "validationStatus", "validationReviewedAt", "termsAcceptedAt", "sessionVersion", "canManageTeachers", "createdAt", "updatedAt")
SELECT 'qa_teacher_20261101', 'QA Teacher', 'qa.teacher@satsol.org', '$2b$10$Ebw2Ya1O3UL5aKImoYxC1egjsONRV7U/jCONrsL.NwoAxW9bF6gjG', 'TEACHER', 1, 'APPROVED', '2026-11-02T00:30:00.000+00:00', '2026-11-02T00:30:00.000+00:00', 0, 0, '2026-11-02T00:30:00.000+00:00', '2026-11-02T00:30:00.000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'qa.teacher@satsol.org');
INSERT INTO "ProgramTeacher" ("programId", "teacherId", "startDate")
SELECT 'program-sat-core', 'qa_teacher_20261101', '2026-11-02T00:30:00.000+00:00'
WHERE EXISTS (SELECT 1 FROM "Program" WHERE "id" = 'program-sat-core')
  AND EXISTS (SELECT 1 FROM "User" WHERE "id" = 'qa_teacher_20261101')
  AND NOT EXISTS (SELECT 1 FROM "ProgramTeacher" WHERE "teacherId" = 'qa_teacher_20261101');
