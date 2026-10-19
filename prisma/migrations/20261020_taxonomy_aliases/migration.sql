-- Domain ↔ Skill correspondence aliases (lib/taxonomy-reference.ts ← Taxonomia-SAT.md + reference PDFs).
-- The platform shows the md names; aliases are the PDF spellings (e.g. "Grammar" for Form, Structure & Sense)
-- and former names, used to match ingest files. Admins can add more in Admin → Taxonomy.

-- CreateTable
CREATE TABLE "TaxonomyAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alias" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "topicId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxonomyAlias_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaxonomyAlias_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TaxonomyAlias_domainId_idx" ON "TaxonomyAlias"("domainId");

-- CreateIndex
CREATE INDEX "TaxonomyAlias_topicId_idx" ON "TaxonomyAlias"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyAlias_kind_alias_key" ON "TaxonomyAlias"("kind", "alias");

-- Reference aliases
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-linear-equations-in-one-variable', 'Linear equations in one variable', 'SKILL', 'dom-algebra', 'top-lineq-one-var', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-lineq-one-var');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-linear-functions', 'Linear functions', 'SKILL', 'dom-algebra', 'top-linfn', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-linfn');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-linear-equations-in-two-variables', 'Linear equations in two variables', 'SKILL', 'dom-algebra', 'top-lineq-two-var', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-lineq-two-var');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-systems-of-two-linear-equations-in-two-variables', 'Systems of two linear equations in two variables', 'SKILL', 'dom-algebra', 'top-systems-two-linear', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-systems-two-linear');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-linear-inequalities-in-one-or-two-variables', 'Linear inequalities in one or two variables', 'SKILL', 'dom-algebra', 'top-linineq', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-linineq');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-nonlinear-functions', 'Nonlinear functions', 'SKILL', 'dom-advmath', 'top-nonlinfn', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-nonlinfn');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-nonlinear-equations-in-one-variable-and-systems-of-equations-in-two-variables', 'Nonlinear equations in one variable and systems of equations in two variables', 'SKILL', 'dom-advmath', 'top-nonlinear-equations', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-nonlinear-equations');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-equivalent-expressions', 'Equivalent expressions', 'SKILL', 'dom-advmath', 'top-equivalent-expressions', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-equivalent-expressions');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-domain-pdf-problem-solving-and-data-analysis', 'Problem Solving and Data Analysis', 'DOMAIN', 'dom-psda', NULL, 'PDF' WHERE EXISTS (SELECT 1 FROM "Domain" WHERE "id" = 'dom-psda');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-domain-legacy-problem-solving-and-data-analysis', 'Problem-Solving and Data Analysis', 'DOMAIN', 'dom-psda', NULL, 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Domain" WHERE "id" = 'dom-psda');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-domain-legacy-problem-solving-data-analysis', 'Problem solving data Analysis', 'DOMAIN', 'dom-psda', NULL, 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Domain" WHERE "id" = 'dom-psda');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-ratios-rates-proportional-relationships-and-units', 'Ratios, rates, proportional relationships, and units', 'SKILL', 'dom-psda', 'top-ratios-rates-units', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-ratios-rates-units');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-pdf-claims-studies-experiments', 'Claims, Studies & Experiments', 'SKILL', 'dom-psda', 'top-statistical-claims', 'PDF' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-statistical-claims');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-statistical-claims', 'Statistical Claims', 'SKILL', 'dom-psda', 'top-statistical-claims', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-statistical-claims');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-one-variable-data-distributions-and-measures-of-center-and-spread', 'One-variable data: Distributions and measures of center and spread', 'SKILL', 'dom-psda', 'top-data-mean', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-data-mean');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-probability-and-conditional-probability', 'Probability and conditional probability', 'SKILL', 'dom-psda', 'top-prob', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-prob');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-two-variable-data-models-and-scatterplots', 'Two-variable data: Models and scatterplots', 'SKILL', 'dom-psda', 'top-two-var-data', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-two-var-data');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-inference-from-statistics-and-margin-of-error', 'Inference from Statistics and Margin of Error', 'SKILL', 'dom-psda', 'top-inference-margin', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-inference-margin');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-domain-pdf-geometry-and-trigonometry', 'Geometry and Trigonometry', 'DOMAIN', 'dom-geotrig', NULL, 'PDF' WHERE EXISTS (SELECT 1 FROM "Domain" WHERE "id" = 'dom-geotrig');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-area-and-volume', 'Area and volume', 'SKILL', 'dom-geotrig', 'top-area-volume', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-area-volume');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-lines-angles-and-triangles', 'Lines, angles, and triangles', 'SKILL', 'dom-geotrig', 'top-lines-angles-triangles', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-lines-angles-triangles');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-right-triangles-and-trigonometry', 'Right triangles and trigonometry', 'SKILL', 'dom-geotrig', 'top-right-tri-trig', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-right-tri-trig');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-central-ideas-and-details', 'Central Ideas and Details', 'SKILL', 'dom-info', 'top-central-details', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-central-details');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-pdf-cross-text-connections', 'Cross Text Connections', 'SKILL', 'dom-craft', 'top-cross', 'PDF' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-cross');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-pdf-grammar', 'Grammar', 'SKILL', 'dom-sec', 'top-fss', 'PDF' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-fss');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-grammar-and-structure', 'Grammar and Structure', 'SKILL', 'dom-sec', 'top-fss', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-fss');
INSERT OR IGNORE INTO "TaxonomyAlias" ("id", "alias", "kind", "domainId", "topicId", "source") SELECT 'tal-skill-legacy-form-structure-and-sense', 'Form, Structure, and Sense', 'SKILL', 'dom-sec', 'top-fss', 'LEGACY' WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "id" = 'top-fss');
