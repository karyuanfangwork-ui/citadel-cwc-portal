-- Task 19: Tenant + department PostgreSQL RLS for governed Request root.
-- Staged safely: validate ownership first, add validated ownership constraints,
-- then enable forced RLS using transaction-local app.* claims.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cwc_app_rls') THEN
        CREATE ROLE cwc_app_rls NOLOGIN NOBYPASSRLS;
    END IF;
END $$;

UPDATE "requests" r
SET "tenant_id" = COALESCE(
        r."tenant_id",
        (SELECT sd."tenant_id" FROM "service_desks" sd WHERE sd."id" = r."service_desk_id"),
        (SELECT rt."tenant_id" FROM "request_types" rt WHERE rt."id" = r."request_type_id"),
        (SELECT u."tenant_id" FROM "users" u WHERE u."id" = r."requester_id")
    ),
    "department_id" = COALESCE(
        r."department_id",
        (SELECT sd."department_id" FROM "service_desks" sd WHERE sd."id" = r."service_desk_id")
    )
WHERE r."tenant_id" IS NULL OR r."department_id" IS NULL;

DO $$
DECLARE
    missing_count integer;
    inconsistent_count integer;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM "requests"
    WHERE "tenant_id" IS NULL OR "department_id" IS NULL;

    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Cannot enable Request RLS: % requests are missing tenant_id or department_id', missing_count;
    END IF;

    SELECT COUNT(*) INTO inconsistent_count
    FROM "requests" r
    LEFT JOIN "departments" d ON d."id" = r."department_id"
    WHERE d."id" IS NULL OR d."tenant_id" IS DISTINCT FROM r."tenant_id";

    IF inconsistent_count > 0 THEN
        RAISE EXCEPTION 'Cannot enable Request RLS: % requests have invalid department ownership', inconsistent_count;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_requests_tenant_id_required'
    ) THEN
        ALTER TABLE "requests"
            ADD CONSTRAINT "chk_requests_tenant_id_required" CHECK ("tenant_id" IS NOT NULL) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_requests_department_id_required'
    ) THEN
        ALTER TABLE "requests"
            ADD CONSTRAINT "chk_requests_department_id_required" CHECK ("department_id" IS NOT NULL) NOT VALID;
    END IF;
END $$;

ALTER TABLE "requests" VALIDATE CONSTRAINT "chk_requests_tenant_id_required";
ALTER TABLE "requests" VALIDATE CONSTRAINT "chk_requests_department_id_required";

CREATE OR REPLACE FUNCTION public.app_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.app_current_department_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN NULLIF(current_setting('app.department_ids', true), '') IS NULL THEN ARRAY[]::uuid[]
        ELSE string_to_array(current_setting('app.department_ids', true), ',')::uuid[]
    END
$$;

ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "requests" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "request_scope" ON "requests";
CREATE POLICY "request_scope" ON "requests"
FOR ALL
USING (
    "tenant_id" = public.app_current_tenant_id()
    AND "department_id" = ANY(public.app_current_department_ids())
)
WITH CHECK (
    "tenant_id" = public.app_current_tenant_id()
    AND "department_id" = ANY(public.app_current_department_ids())
);

GRANT USAGE ON SCHEMA public TO cwc_app_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON "requests" TO cwc_app_rls;
GRANT EXECUTE ON FUNCTION public.app_current_tenant_id() TO cwc_app_rls;
GRANT EXECUTE ON FUNCTION public.app_current_department_ids() TO cwc_app_rls;
