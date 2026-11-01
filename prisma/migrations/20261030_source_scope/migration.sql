-- Source scope: which content a source is offered for. Innovator is a Tests source only (not Practice
-- Sets). ADD-only (no table rebuild: section triggers and the single-open-attempt partial indexes stay).

-- AlterTable
ALTER TABLE "Source" ADD COLUMN "forPracticeSets" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Source" ADD COLUMN "forTests" BOOLEAN NOT NULL DEFAULT true;

-- Data
UPDATE "Source" SET "forPracticeSets" = false WHERE "id" = 'src_innovator';
