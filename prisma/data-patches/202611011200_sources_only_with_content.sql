-- Sources: keep only the ones that have content (user decision 2026-11-01).
-- College Board 2025 / 2026 (Tests-only, empty) become inactive: they leave Tests, filters and Assign.
-- College Board keeps its Practice Sets but is no longer offered for Tests (it has none).
-- Guards: previous value, and no content in that source.
-- expect: 3
UPDATE "Source" SET "active" = 0
WHERE "id" IN ('src_college_board_2025', 'src_college_board_2026') AND "active" = 1
  AND NOT EXISTS (SELECT 1 FROM "FullPracticeTest" t WHERE t."sourceId" = "Source"."id")
  AND NOT EXISTS (SELECT 1 FROM "PracticeSet" p WHERE p."sourceId" = "Source"."id");
UPDATE "Source" SET "forTests" = 0
WHERE "id" = 'src_college_board' AND "forTests" = 1
  AND NOT EXISTS (SELECT 1 FROM "FullPracticeTest" t WHERE t."sourceId" = 'src_college_board');
