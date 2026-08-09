-- backend/prisma/migrations/20260810090000_credit_audit_immutability/migration.sql
-- LOS-013 — Make the credit audit chain append-only at the database level.
--
-- Application-level serialization (pg_advisory_xact_lock) prevents chain forks,
-- but nothing stopped the application role from rewriting history. This trigger
-- denies UPDATE and DELETE regardless of role.
--
-- Maintenance paths (chain rehash, `prisma migrate reset` teardown) set the
-- session-local GUC app.audit_chain_bypass = 'on' to proceed. The GUC is
-- transaction-scoped via set_config(..., true), so it cannot leak between
-- requests on a pooled connection.

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