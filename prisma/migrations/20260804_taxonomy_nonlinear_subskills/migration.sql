INSERT OR IGNORE INTO "Topic" ("id", "name", "domainId")
SELECT 'top-nonlinfn', 'Nonlinear Functions', 'dom-advmath'
WHERE EXISTS (SELECT 1 FROM "Domain" WHERE "id" = 'dom-advmath');

INSERT OR IGNORE INTO "Subskill" ("id", "name", "topicId")
SELECT 'sub-nonlin-transform-recip', 'Function transformations / Reciprocal functions', 'top-nonlinfn'
WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-nonlinfn');

INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'tax-skill-top-nonlinfn',
  'Nonlinear Functions',
  'Nonlinear Functions',
  'SKILL',
  'tax-topic-dom-advmath',
  10,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "TaxonomyNode" WHERE "id" = 'tax-topic-dom-advmath');

UPDATE "Topic"
SET "taxonomyNodeId" = 'tax-skill-top-nonlinfn'
WHERE "id" = 'top-nonlinfn' AND "taxonomyNodeId" IS NULL;

INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'tax-subskill-sub-nonlin-transform-recip',
  'Function transformations / Reciprocal functions',
  'Function transformations / Reciprocal functions',
  'SUBSKILL',
  'tax-skill-top-nonlinfn',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "TaxonomyNode" WHERE "id" = 'tax-skill-top-nonlinfn');

UPDATE "Subskill"
SET "taxonomyNodeId" = 'tax-subskill-sub-nonlin-transform-recip'
WHERE "id" = 'sub-nonlin-transform-recip' AND "taxonomyNodeId" IS NULL;
