UPDATE "TaxonomyNode"
SET "type" = 'DOMAIN',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'TOPIC';
