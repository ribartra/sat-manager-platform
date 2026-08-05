INSERT INTO "AppSetting" ("key", "value", "updatedAt")
VALUES ('TEACHER_GROUP_MANAGEMENT', 'false', CURRENT_TIMESTAMP)
ON CONFLICT("key") DO UPDATE SET "value" = 'false', "updatedAt" = CURRENT_TIMESTAMP;

DELETE FROM "GroupAssignment";
DELETE FROM "GroupMembership";
DELETE FROM "Group";
