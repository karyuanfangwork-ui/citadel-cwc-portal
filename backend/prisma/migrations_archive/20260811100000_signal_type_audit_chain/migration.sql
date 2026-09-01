-- Phase 6a — a broken audit chain needs its own signal type so it can be
-- filtered and alerted on, rather than disappearing into OTHER.
ALTER TYPE "SignalType" ADD VALUE IF NOT EXISTS 'AUDIT_CHAIN_BROKEN';