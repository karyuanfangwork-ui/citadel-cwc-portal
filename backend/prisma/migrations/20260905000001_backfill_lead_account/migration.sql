UPDATE "crm_leads" l
SET "account_id" = o."account_id"
FROM "crm_opportunities" o
WHERE l."converted_to_opp_id" = o."id"
  AND l."account_id" IS NULL;
