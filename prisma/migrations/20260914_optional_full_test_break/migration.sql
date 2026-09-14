-- SQLite does not support ALTER COLUMN. The application/API now always
-- supplies the explicit default of 0; normalize existing records here.
UPDATE "FullPracticeTest" SET "breakMinutes" = 0 WHERE "breakMinutes" = 10;
