-- Official practice sections: Math, Reading, Writing (product rule: Practice has 3 areas; Tests have 2
-- sections, so READING_WRITING stays only for the Test placeholder domain "Full Practice Test").
-- Domain.practiceArea is kept as a copy of its Section and the triggers below keep both in sync.
-- Data-only + triggers (not expressible in schema.prisma): keep them when generating future migrations.

UPDATE "Section" SET "label" = 'Math' WHERE "name" = 'MATH';
UPDATE "Section" SET "label" = 'Reading & Writing' WHERE "name" = 'READING_WRITING';
INSERT OR IGNORE INTO "Section" ("id", "name", "label") VALUES ('sec-reading', 'READING', 'Reading');
INSERT OR IGNORE INTO "Section" ("id", "name", "label") VALUES ('sec-writing', 'WRITING', 'Writing');

-- Reading and Writing domains move out of the combined section.
UPDATE "Domain" SET "sectionId" = (SELECT "id" FROM "Section" WHERE "name" = 'READING') WHERE "practiceArea" = 'READING';
UPDATE "Domain" SET "sectionId" = (SELECT "id" FROM "Section" WHERE "name" = 'WRITING') WHERE "practiceArea" = 'WRITING';

-- Parallel TaxonomyNode tree: one AREA node per section (id tax-area-<sectionId>), domains re-parented.
INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active")
SELECT 'tax-area-' || "id", "name", "label", 'AREA', NULL, 0, true FROM "Section";
UPDATE "TaxonomyNode" SET
  "label" = (SELECT s."label" FROM "Section" s WHERE 'tax-area-' || s."id" = "TaxonomyNode"."id"),
  "sortOrder" = CASE "name" WHEN 'MATH' THEN 0 WHEN 'READING' THEN 1 WHEN 'WRITING' THEN 2 ELSE 3 END,
  -- READING_WRITING has no practice domains (only the Test placeholder, which has no node).
  "active" = CASE "name" WHEN 'READING_WRITING' THEN false ELSE true END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'AREA' AND "id" IN (SELECT 'tax-area-' || "id" FROM "Section");
UPDATE "TaxonomyNode" SET
  "parentId" = (SELECT 'tax-area-' || d."sectionId" FROM "Domain" d WHERE 'tax-topic-' || d."id" = "TaxonomyNode"."id"),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'DOMAIN' AND "id" IN (SELECT 'tax-topic-' || "id" FROM "Domain");

-- practiceArea must be NULL (Test placeholders) or equal to its Section's name.
CREATE TRIGGER "Domain_practiceArea_matches_section_insert"
BEFORE INSERT ON "Domain"
WHEN NEW."practiceArea" IS NOT NULL AND NEW."practiceArea" IS NOT (SELECT "name" FROM "Section" WHERE "id" = NEW."sectionId")
BEGIN SELECT RAISE(ABORT, 'Domain.practiceArea must match its Section (MATH, READING or WRITING)'); END;

CREATE TRIGGER "Domain_practiceArea_matches_section_update"
BEFORE UPDATE OF "practiceArea", "sectionId" ON "Domain"
WHEN NEW."practiceArea" IS NOT NULL AND NEW."practiceArea" IS NOT (SELECT "name" FROM "Section" WHERE "id" = NEW."sectionId")
BEGIN SELECT RAISE(ABORT, 'Domain.practiceArea must match its Section (MATH, READING or WRITING)'); END;

CREATE TRIGGER "Section_name_locked_by_practice_domains"
BEFORE UPDATE OF "name" ON "Section"
WHEN EXISTS (SELECT 1 FROM "Domain" WHERE "sectionId" = OLD."id" AND "practiceArea" IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Section name is used as the practice area of its domains'); END;
