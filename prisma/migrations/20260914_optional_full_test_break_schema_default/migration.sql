-- SQLite requires a table rebuild to change a column default.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FullPracticeTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FullPracticeTest" ("breakMinutes", "createdAt", "id", "name", "reviewEnabled", "status", "updatedAt")
SELECT "breakMinutes", "createdAt", "id", "name", "reviewEnabled", "status", "updatedAt"
FROM "FullPracticeTest";
DROP TABLE "FullPracticeTest";
ALTER TABLE "new_FullPracticeTest" RENAME TO "FullPracticeTest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
