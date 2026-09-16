-- Persisted Practice area on Domain (MATH | READING | WRITING).
-- Null reserved for non-academic placeholders such as "Full Practice Test".
ALTER TABLE "Domain" ADD COLUMN "practiceArea" TEXT;

CREATE INDEX "Domain_practiceArea_idx" ON "Domain"("practiceArea");

UPDATE "Domain" SET "practiceArea" = 'MATH'
WHERE "name" IN (
  'Algebra',
  'Advanced Math',
  'Problem Solving and Data Analysis',
  'Geometry and Trigonometry'
);

UPDATE "Domain" SET "practiceArea" = 'READING'
WHERE "name" IN (
  'Information and Ideas',
  'Craft and Structure'
);

UPDATE "Domain" SET "practiceArea" = 'WRITING'
WHERE "name" IN (
  'Expression of Ideas',
  'Standard English Conventions'
);

-- Canonical Writing skill rename (meeting 14/09).
UPDATE "Topic"
SET "name" = 'Grammar and Structure'
WHERE "name" = 'Form, Structure, and Sense'
   OR "id" = 'top-fss';

UPDATE "TaxonomyNode"
SET "name" = 'Grammar and Structure',
    "label" = 'Grammar and Structure'
WHERE "name" = 'Form, Structure, and Sense'
   OR "id" = 'tax-skill-top-fss';
