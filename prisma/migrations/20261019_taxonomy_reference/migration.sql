-- Reference SAT taxonomy (Taxonomia-SAT.md, 2026-10-19): skill and domain names, display order,
-- and removal of 16 legacy skills that never had practice sets, questions, materials or subskills.
-- Topic ids are unchanged, so sets, questions, attempts and snapshots keep their links.

-- 1. Domains (and their DOMAIN nodes)
UPDATE "Domain" SET "name" = 'Algebra' WHERE "id" = 'dom-algebra';
UPDATE "TaxonomyNode" SET "name" = 'Algebra', "label" = 'Algebra', "sortOrder" = 0, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-algebra';
UPDATE "Domain" SET "name" = 'Advanced Math' WHERE "id" = 'dom-advmath';
UPDATE "TaxonomyNode" SET "name" = 'Advanced Math', "label" = 'Advanced Math', "sortOrder" = 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-advmath';
UPDATE "Domain" SET "name" = 'Problem Solving & Data Analysis' WHERE "id" = 'dom-psda';
UPDATE "TaxonomyNode" SET "name" = 'Problem Solving & Data Analysis', "label" = 'Problem Solving & Data Analysis', "sortOrder" = 2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-psda';
UPDATE "Domain" SET "name" = 'Geometry & Trigonometry' WHERE "id" = 'dom-geotrig';
UPDATE "TaxonomyNode" SET "name" = 'Geometry & Trigonometry', "label" = 'Geometry & Trigonometry', "sortOrder" = 3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-geotrig';
UPDATE "Domain" SET "name" = 'Information and Ideas' WHERE "id" = 'dom-info';
UPDATE "TaxonomyNode" SET "name" = 'Information and Ideas', "label" = 'Information and Ideas', "sortOrder" = 4, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-info';
UPDATE "Domain" SET "name" = 'Craft and Structure' WHERE "id" = 'dom-craft';
UPDATE "TaxonomyNode" SET "name" = 'Craft and Structure', "label" = 'Craft and Structure', "sortOrder" = 5, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-craft';
UPDATE "Domain" SET "name" = 'Standard English Conventions' WHERE "id" = 'dom-sec';
UPDATE "TaxonomyNode" SET "name" = 'Standard English Conventions', "label" = 'Standard English Conventions', "sortOrder" = 6, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-sec';
UPDATE "Domain" SET "name" = 'Expression of Ideas' WHERE "id" = 'dom-expr';
UPDATE "TaxonomyNode" SET "name" = 'Expression of Ideas', "label" = 'Expression of Ideas', "sortOrder" = 7, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'tax-topic-dom-expr';

-- 2. Skills (Topic) and their SKILL nodes, in reference order
UPDATE "Topic" SET "name" = 'Linear Equations in One Variable' WHERE "id" = 'top-lineq-one-var';
UPDATE "TaxonomyNode" SET "name" = 'Linear Equations in One Variable', "label" = 'Linear Equations in One Variable', "sortOrder" = 0, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-lineq-one-var');
UPDATE "Topic" SET "name" = 'Linear Functions' WHERE "id" = 'top-linfn';
UPDATE "TaxonomyNode" SET "name" = 'Linear Functions', "label" = 'Linear Functions', "sortOrder" = 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-linfn');
UPDATE "Topic" SET "name" = 'Linear Equations in Two Variables' WHERE "id" = 'top-lineq-two-var';
UPDATE "TaxonomyNode" SET "name" = 'Linear Equations in Two Variables', "label" = 'Linear Equations in Two Variables', "sortOrder" = 2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-lineq-two-var');
UPDATE "Topic" SET "name" = 'Systems of Linear Equations' WHERE "id" = 'top-systems-two-linear';
UPDATE "TaxonomyNode" SET "name" = 'Systems of Linear Equations', "label" = 'Systems of Linear Equations', "sortOrder" = 3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-systems-two-linear');
UPDATE "Topic" SET "name" = 'Linear Inequalities' WHERE "id" = 'top-linineq';
UPDATE "TaxonomyNode" SET "name" = 'Linear Inequalities', "label" = 'Linear Inequalities', "sortOrder" = 4, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-linineq');
UPDATE "Topic" SET "name" = 'Nonlinear Functions' WHERE "id" = 'top-nonlinfn';
UPDATE "TaxonomyNode" SET "name" = 'Nonlinear Functions', "label" = 'Nonlinear Functions', "sortOrder" = 5, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-nonlinfn');
UPDATE "Topic" SET "name" = 'Nonlinear Equations' WHERE "id" = 'top-nonlinear-equations';
UPDATE "TaxonomyNode" SET "name" = 'Nonlinear Equations', "label" = 'Nonlinear Equations', "sortOrder" = 6, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-nonlinear-equations');
UPDATE "Topic" SET "name" = 'Equivalent Expressions' WHERE "id" = 'top-equivalent-expressions';
UPDATE "TaxonomyNode" SET "name" = 'Equivalent Expressions', "label" = 'Equivalent Expressions', "sortOrder" = 7, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-equivalent-expressions');
UPDATE "Topic" SET "name" = 'Ratios, Rates, Proportions & Units' WHERE "id" = 'top-ratios-rates-units';
UPDATE "TaxonomyNode" SET "name" = 'Ratios, Rates, Proportions & Units', "label" = 'Ratios, Rates, Proportions & Units', "sortOrder" = 8, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-ratios-rates-units');
UPDATE "Topic" SET "name" = 'Percentages' WHERE "id" = 'top-pct';
UPDATE "TaxonomyNode" SET "name" = 'Percentages', "label" = 'Percentages', "sortOrder" = 9, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-pct');
UPDATE "Topic" SET "name" = 'Data, Studies & Experiments' WHERE "id" = 'top-statistical-claims';
UPDATE "TaxonomyNode" SET "name" = 'Data, Studies & Experiments', "label" = 'Data, Studies & Experiments', "sortOrder" = 10, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-statistical-claims');
UPDATE "Topic" SET "name" = 'Distributions, Center & Spread' WHERE "id" = 'top-data-mean';
UPDATE "TaxonomyNode" SET "name" = 'Distributions, Center & Spread', "label" = 'Distributions, Center & Spread', "sortOrder" = 11, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-data-mean');
UPDATE "Topic" SET "name" = 'Probability' WHERE "id" = 'top-prob';
UPDATE "TaxonomyNode" SET "name" = 'Probability', "label" = 'Probability', "sortOrder" = 12, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-prob');
UPDATE "Topic" SET "name" = 'Scatterplots & Models' WHERE "id" = 'top-two-var-data';
UPDATE "TaxonomyNode" SET "name" = 'Scatterplots & Models', "label" = 'Scatterplots & Models', "sortOrder" = 13, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-two-var-data');
UPDATE "Topic" SET "name" = 'Statistical Inference' WHERE "id" = 'top-inference-margin';
UPDATE "TaxonomyNode" SET "name" = 'Statistical Inference', "label" = 'Statistical Inference', "sortOrder" = 14, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-inference-margin');
UPDATE "Topic" SET "name" = 'Area & Volume' WHERE "id" = 'top-area-volume';
UPDATE "TaxonomyNode" SET "name" = 'Area & Volume', "label" = 'Area & Volume', "sortOrder" = 15, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-area-volume');
UPDATE "Topic" SET "name" = 'Lines, Angles & Triangles' WHERE "id" = 'top-lines-angles-triangles';
UPDATE "TaxonomyNode" SET "name" = 'Lines, Angles & Triangles', "label" = 'Lines, Angles & Triangles', "sortOrder" = 16, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-lines-angles-triangles');
UPDATE "Topic" SET "name" = 'Circles' WHERE "id" = 'top-circles';
UPDATE "TaxonomyNode" SET "name" = 'Circles', "label" = 'Circles', "sortOrder" = 17, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-circles');
UPDATE "Topic" SET "name" = 'Right Triangles & Trigonometry' WHERE "id" = 'top-right-tri-trig';
UPDATE "TaxonomyNode" SET "name" = 'Right Triangles & Trigonometry', "label" = 'Right Triangles & Trigonometry', "sortOrder" = 18, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-right-tri-trig');
UPDATE "Topic" SET "name" = 'Main Ideas and Details' WHERE "id" = 'top-central-details';
UPDATE "TaxonomyNode" SET "name" = 'Main Ideas and Details', "label" = 'Main Ideas and Details', "sortOrder" = 19, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-central-details');
UPDATE "Topic" SET "name" = 'Command of Evidence' WHERE "id" = 'top-command-evidence';
UPDATE "TaxonomyNode" SET "name" = 'Command of Evidence', "label" = 'Command of Evidence', "sortOrder" = 20, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-command-evidence');
UPDATE "Topic" SET "name" = 'Inferences' WHERE "id" = 'top-infer';
UPDATE "TaxonomyNode" SET "name" = 'Inferences', "label" = 'Inferences', "sortOrder" = 21, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-infer');
UPDATE "Topic" SET "name" = 'Words in Context' WHERE "id" = 'top-wic';
UPDATE "TaxonomyNode" SET "name" = 'Words in Context', "label" = 'Words in Context', "sortOrder" = 22, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-wic');
UPDATE "Topic" SET "name" = 'Text Structure and Purpose' WHERE "id" = 'top-text-structure-purpose';
UPDATE "TaxonomyNode" SET "name" = 'Text Structure and Purpose', "label" = 'Text Structure and Purpose', "sortOrder" = 23, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-text-structure-purpose');
UPDATE "Topic" SET "name" = 'Cross-Text Connections' WHERE "id" = 'top-cross';
UPDATE "TaxonomyNode" SET "name" = 'Cross-Text Connections', "label" = 'Cross-Text Connections', "sortOrder" = 24, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-cross');
UPDATE "Topic" SET "name" = 'Boundaries' WHERE "id" = 'top-bound';
UPDATE "TaxonomyNode" SET "name" = 'Boundaries', "label" = 'Boundaries', "sortOrder" = 25, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-bound');
UPDATE "Topic" SET "name" = 'Form, Structure & Sense' WHERE "id" = 'top-fss';
UPDATE "TaxonomyNode" SET "name" = 'Form, Structure & Sense', "label" = 'Form, Structure & Sense', "sortOrder" = 26, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-fss');
UPDATE "Topic" SET "name" = 'Transitions' WHERE "id" = 'top-trans';
UPDATE "TaxonomyNode" SET "name" = 'Transitions', "label" = 'Transitions', "sortOrder" = 27, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-trans');
UPDATE "Topic" SET "name" = 'Rhetorical Synthesis' WHERE "id" = 'top-rhet';
UPDATE "TaxonomyNode" SET "name" = 'Rhetorical Synthesis', "label" = 'Rhetorical Synthesis', "sortOrder" = 28, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = (SELECT "taxonomyNodeId" FROM "Topic" WHERE "id" = 'top-rhet');

-- 3. Legacy skills: delete only when nothing points at them
CREATE TEMP TABLE "_removed_skill" AS SELECT "id", "taxonomyNodeId" FROM "Topic" t WHERE t."id" IN ('top-lineq', 'top-syseq', 'top-ineq', 'top-quadfn', 'top-poly', 'top-expfn', 'top-radeq', 'top-ratprop', 'top-stats', 'top-tri', 'top-trig', 'top-vol', 'top-central', 'top-textev', 'top-texstr', 'top-authpur')
  AND NOT EXISTS (SELECT 1 FROM "PracticeSet" p WHERE p."topicId" = t."id")
  AND NOT EXISTS (SELECT 1 FROM "Question" x WHERE x."topicId" = t."id")
  AND NOT EXISTS (SELECT 1 FROM "StudyMaterial" m WHERE m."topicId" = t."id")
  AND NOT EXISTS (SELECT 1 FROM "Subskill" s WHERE s."topicId" = t."id");
DELETE FROM "Topic" WHERE "id" IN (SELECT "id" FROM "_removed_skill");
DELETE FROM "TaxonomyNode" WHERE "type" = 'SKILL' AND "id" IN (SELECT "taxonomyNodeId" FROM "_removed_skill" WHERE "taxonomyNodeId" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "TaxonomyNode" c WHERE c."parentId" = "TaxonomyNode"."id");
DROP TABLE "_removed_skill";

-- 4. Practice set names follow "Domain - Skill - DIFFICULTY[ - #n]": rebuild them with the reference
--    names (custom-named sets are left alone; attempt snapshots keep the name they had).
UPDATE "PracticeSet" SET "name" = (
    SELECT d."name" || ' - ' || t."name" || ' - ' || "PracticeSet"."difficulty"
    FROM "Topic" t JOIN "Domain" d ON d."id" = t."domainId" WHERE t."id" = "PracticeSet"."topicId"
  ) || CASE WHEN instr("name", ' - #') > 0 THEN substr("name", instr("name", ' - #')) ELSE '' END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE ("name" LIKE '% - ' || "difficulty" OR "name" LIKE '% - ' || "difficulty" || ' - #%')
  AND EXISTS (SELECT 1 FROM "Topic" t JOIN "Domain" d ON d."id" = t."domainId" WHERE t."id" = "PracticeSet"."topicId" AND d."practiceArea" IS NOT NULL);
