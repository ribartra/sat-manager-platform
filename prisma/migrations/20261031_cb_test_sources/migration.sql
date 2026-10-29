-- Test sources by edition (SAT-022): College Board 2025 and 2026 are Tests-only sources, kept apart
-- from Innovator and from the College Board Practice Sets source. Data only (no schema change);
-- OR IGNORE keeps a source an admin may already have created with the same name.
INSERT OR IGNORE INTO "Source" ("id", "name", "active", "sortOrder", "forPracticeSets", "forTests") VALUES ('src_college_board_2025', 'College Board 2025', true, 3, false, true);
INSERT OR IGNORE INTO "Source" ("id", "name", "active", "sortOrder", "forPracticeSets", "forTests") VALUES ('src_college_board_2026', 'College Board 2026', true, 4, false, true);
