-- Progressive recursive taxonomy. Existing Section/Domain/Topic/Subskill remain
-- as compatibility tables for operational flows.
CREATE TABLE "TaxonomyNode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "parentId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomyNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaxonomyNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TaxonomyNode_parentId_idx" ON "TaxonomyNode"("parentId");
CREATE INDEX "TaxonomyNode_type_idx" ON "TaxonomyNode"("type");
CREATE UNIQUE INDEX "TaxonomyNode_parentId_type_name_key" ON "TaxonomyNode"("parentId", "type", "name");

ALTER TABLE "Topic" ADD COLUMN "taxonomyNodeId" TEXT;
ALTER TABLE "Subskill" ADD COLUMN "taxonomyNodeId" TEXT;

CREATE INDEX "Topic_taxonomyNodeId_idx" ON "Topic"("taxonomyNodeId");
CREATE INDEX "Subskill_taxonomyNodeId_idx" ON "Subskill"("taxonomyNodeId");

INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'tax-area-' || "id",
  "name",
  "label",
  'AREA',
  NULL,
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Section";

INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'tax-topic-' || d."id",
  d."name",
  d."name",
  'DOMAIN',
  'tax-area-' || d."sectionId",
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Domain" d;

INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'tax-skill-' || t."id",
  t."name",
  t."name",
  'SKILL',
  'tax-topic-' || t."domainId",
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Topic" t;

UPDATE "Topic"
SET "taxonomyNodeId" = 'tax-skill-' || "id"
WHERE "taxonomyNodeId" IS NULL;

INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'tax-subskill-' || ss."id",
  ss."name",
  ss."name",
  'SUBSKILL',
  'tax-skill-' || ss."topicId",
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Subskill" ss;

UPDATE "Subskill"
SET "taxonomyNodeId" = 'tax-subskill-' || "id"
WHERE "taxonomyNodeId" IS NULL;
