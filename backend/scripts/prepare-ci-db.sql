-- CI-only DDL for a disposable PostgreSQL service after `prisma db push`.
-- Do not run this fixture against production or a shared development database.
-- These definitions mirror the archived migrations that Prisma db push cannot apply.

-- migrations_archive/20260811110000_borrower_operational_fields
CREATE SEQUENCE IF NOT EXISTS borrower_number_seq START WITH 1 INCREMENT BY 1;

-- migrations_archive/20260810090000_credit_audit_immutability
CREATE OR REPLACE FUNCTION credit_audit_events_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.audit_chain_bypass', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'credit_audit_events is append-only: % is not permitted (LOS-013)', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS credit_audit_events_immutable ON credit_audit_events;
CREATE TRIGGER credit_audit_events_immutable
BEFORE UPDATE OR DELETE ON credit_audit_events
FOR EACH ROW
EXECUTE FUNCTION credit_audit_events_deny_mutation();

-- migrations_archive/20260805000000_workflow_policy_and_history_guards
CREATE OR REPLACE FUNCTION prevent_workflow_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'workflow history is immutable';
END;
$$;

DROP TRIGGER IF EXISTS workflow_history_immutable ON workflow_history;
CREATE TRIGGER workflow_history_immutable
BEFORE UPDATE ON workflow_history
FOR EACH ROW
EXECUTE FUNCTION prevent_workflow_history_mutation();

-- migrations_archive/20260721000200_tenant_department_rls
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cwc_app_rls') THEN
    CREATE ROLE cwc_app_rls NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
