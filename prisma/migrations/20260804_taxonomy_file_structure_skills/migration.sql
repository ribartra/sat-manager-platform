INSERT OR IGNORE INTO "Topic" ("id", "name", "domainId") VALUES
  ('top-lineq-one-var', 'Linear Equations in One Variable', 'dom-algebra'),
  ('top-lineq-two-var', 'Linear Equations in Two Variables', 'dom-algebra'),
  ('top-systems-two-linear', 'Systems of Two Linear Equations', 'dom-algebra'),
  ('top-linineq', 'Linear Inequalities', 'dom-algebra'),
  ('top-equivalent-expressions', 'Equivalent Expressions', 'dom-advmath'),
  ('top-nonlinear-equations', 'Nonlinear Equations', 'dom-advmath'),
  ('top-ratios-rates-units', 'Ratios, Rates, Proportions, and Units', 'dom-psda'),
  ('top-one-var-data', 'One-Variable Data', 'dom-psda'),
  ('top-data-mean', 'One-Variable Data: Distributions and Measures', 'dom-psda'),
  ('top-two-var-data', 'Two-Variable Data', 'dom-psda'),
  ('top-inference-margin', 'Inference and Margin of Error', 'dom-psda'),
  ('top-statistical-claims', 'Statistical Claims', 'dom-psda'),
  ('top-lines-angles-triangles', 'Lines, Angles, and Triangles', 'dom-geotrig'),
  ('top-area-volume', 'Area and Volume', 'dom-geotrig'),
  ('top-right-tri-trig', 'Right Triangles and Trigonometry', 'dom-geotrig'),
  ('top-central-details', 'Central Ideas and Details', 'dom-info'),
  ('top-command-evidence', 'Command of Evidence', 'dom-info'),
  ('top-text-structure-purpose', 'Text Structure and Purpose', 'dom-craft');

INSERT OR IGNORE INTO "TaxonomyNode" ("id", "name", "label", "type", "parentId", "sortOrder", "active", "createdAt", "updatedAt")
SELECT 'tax-skill-' || t."id", t."name", t."name", 'SKILL', 'tax-topic-' || t."domainId", 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Topic" t
WHERE t."id" IN (
  'top-lineq-one-var',
  'top-lineq-two-var',
  'top-systems-two-linear',
  'top-linineq',
  'top-equivalent-expressions',
  'top-nonlinear-equations',
  'top-ratios-rates-units',
  'top-one-var-data',
  'top-data-mean',
  'top-two-var-data',
  'top-inference-margin',
  'top-statistical-claims',
  'top-lines-angles-triangles',
  'top-area-volume',
  'top-right-tri-trig',
  'top-central-details',
  'top-command-evidence',
  'top-text-structure-purpose'
);

UPDATE "Topic"
SET "taxonomyNodeId" = 'tax-skill-' || "id"
WHERE "id" IN (
  'top-lineq-one-var',
  'top-lineq-two-var',
  'top-systems-two-linear',
  'top-linineq',
  'top-equivalent-expressions',
  'top-nonlinear-equations',
  'top-ratios-rates-units',
  'top-one-var-data',
  'top-data-mean',
  'top-two-var-data',
  'top-inference-margin',
  'top-statistical-claims',
  'top-lines-angles-triangles',
  'top-area-volume',
  'top-right-tri-trig',
  'top-central-details',
  'top-command-evidence',
  'top-text-structure-purpose'
)
AND "taxonomyNodeId" IS NULL;
