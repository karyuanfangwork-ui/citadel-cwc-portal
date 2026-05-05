# CWC 2.0 Seed Data Portability Audit

## Executive Summary

Audit of seed files vs live DB state to ensure migration to new server can reproduce all admin console configurations.

---

## Current State: DB vs Seed Coverage (Updated May 2026)

| Table | DB Count | seed-admin-config.ts | seed.ts | seed-workflows.ts | Status |
|---|---|---|---|---|---|
| ServiceDesk | 3 | - | ✅ 3 (upsert, update:{}) | - | ✅ Safe |
| ServiceCategory | 13 | - | ✅ 13 (upsert, update:{}) | - | ✅ Safe |
| RequestType | 13 | - | ✅ 13 (code upsert, update={} on exist) | - | ✅ Fixed — no longer overwrites slaHours/requiresApproval/isActive |
| WorkflowType | 8 | - | ✅ integrated | ✅ (called from seed.ts) | ✅ Fixed — now integrated, RETAIN_ADMIN_CONFIG-aware |
| WorkflowStep | 55 | - | ✅ integrated | ✅ (called from seed.ts) | ✅ Fixed — now integrated, RETAIN_ADMIN_CONFIG-aware |
| NotificationTemplate | 32 | ✅ 32 | ✅ upsert, update:{} | - | ✅ Safe |
| RequestStatusDefinition | 82 | ✅ 82 | ✅ upsert, update:{} | - | ✅ Safe |
| WorkflowTransition | 85 | ✅ 85 | ✅ upsert, update:{} | - | ✅ Safe |
| BannerConfig | 43 | ✅ 43 | ✅ upsert, update:{} | - | ✅ Safe |
| OnboardingTaskTemplate | 12 | ✅ 12 | ✅ create-only (skip if exists) | - | ✅ Safe |
| OffboardingTaskTemplate | 9 | ✅ 9 | ✅ create-only (skip if exists) | - | ✅ Safe |
| EscalationRule | 2 | ✅ 2 | ✅ create-only (skip if exists) | - | ✅ Safe |
| Entity | 5 | - | ✅ 5 (upsert, update:{}) | - | ✅ Safe (updated from old 3 wrong codes) |
| KnowledgeBaseArticle | 16 | - | ✅ 16 (slug upsert) | - | ✅ Safe |
| RequestTypeEntityRouting | 0 | - | - | - | N/A (empty) |

---

## Fixes Applied (May 2026)

### Fix 1: RequestType no longer overwrites admin-editable fields
**Problem**: When existing RequestType found by code, seed.ts overwrote `slaHours`, `requiresApproval`, and `isActive` with seed defaults, clobbering admin console edits.

**Fix**: All 3 RequestType update blocks (IT, HR, Finance) now only update the `serviceCategory` link and backfill `code` if missing. Admin-editable fields (name, description, formConfig, slaHours, requiresApproval, isActive) are never touched on existing records.

### Fix 2: seed-workflows.ts integrated into main seed flow
**Problem**: `seed-workflows.ts` was an orphaned file never called by `npm run prisma:seed`. Fresh DB seeds would miss all WorkflowType + WorkflowStep records.

**Fix**: `seedWorkflows()` is now exported from `seed-workflows.ts`, imported and called from `seed.ts` after RequestTypes are created. It respects the `RETAIN_ADMIN_CONFIG` flag. Existing workflows are never modified.

### Fix 3: RETAIN_ADMIN_CONFIG now covers WorkflowType/Step
When `RETAIN_ADMIN_CONFIG=true` is set, the new `seedWorkflows()` call skips workflow creation entirely (matching the behavior of all other admin config tables).

---

`seed-admin-config.ts` contains the LATEST DB dump for 6 tables:
- SEED_NOTIFICATION_TEMPLATES (32 entries)
- SEED_STATUS_DEFINITIONS (82 entries)
- SEED_WORKFLOW_TRANSITIONS (85 entries)
- SEED_BANNER_CONFIGS (43 entries)
- SEED_ONBOARDING_TEMPLATES (12 entries)
- SEED_OFFBOARDING_TEMPLATES (9 entries)
- SEED_ESCALATION_RULES (2 entries)

BUT this file has NO exports and is NOT imported by `seed.ts`. It is dead code — the data is never applied to DB.

Meanwhile `seed.ts` has its OWN copies of some of this data (notification templates, status definitions, banner configs, onboarding/offboarding templates) that are OLDER and may conflict.

---

## Critical Finding: Offboarding Template Mismatch

**DB has 9 offboarding templates** (admin deleted 3 from the original 12 + added 1 custom "Fill in required form").

**seed.ts has 12 offboarding templates** (the original hardcoded list, outdated).

**seed-admin-config.ts has 9** (matches DB).

On fresh DB seed, seed.ts would create 12 templates (including 3 the admin intentionally deleted), and the admin's custom "Fill in required form" template would be MISSING.

---

## Critical Finding: Entity Gap

**DB has 5 entities**: CG, CGT, CT360, CWP, NIU

**seed.ts only has 3**: CIT-MY, CIT-SG, CIT-HK (these are OLD codes, no longer in DB!)

This means on fresh DB seed, the entity table would get 3 WRONG entities and be missing all 5 correct ones.

---

## Critical Finding: Banner Config — 23 Admin-Created Banners

DB has 43 banners. Seed defaults in seed.ts only have 20. The additional 23 are ALL role="all" banners created by the admin through the console. These would be LOST on fresh DB seed.

---

## Implementation Plan

### Phase 1: Wire up seed-admin-config.ts (CRITICAL)

**Problem**: seed-admin-config.ts has all the right data but is never executed.

**Steps**:

1.1. Add `export` keyword to all 7 SEED_* constants in seed-admin-config.ts

1.2. Import them in seed.ts:
  ```ts
  import {
    SEED_NOTIFICATION_TEMPLATES,
    SEED_STATUS_DEFINITIONS,
    SEED_WORKFLOW_TRANSITIONS,
    SEED_BANNER_CONFIGS,
    SEED_ONBOARDING_TEMPLATES,
    SEED_OFFBOARDING_TEMPLATES,
    SEED_ESCALATION_RULES,
  } from './seed-admin-config';
  ```

1.3. Replace seed.ts inline data with the imported constants where they overlap:
  - Notification templates: remove inline `templates` array (L788-L1046), use SEED_NOTIFICATION_TEMPLATES
  - Status definitions: remove inline `statusDefinitions` array, use SEED_STATUS_DEFINITIONS
  - Banner configs: remove inline `defaultBanners`, use SEED_BANNER_CONFIGS
  - Onboarding templates: remove inline seed data, use SEED_ONBOARDING_TEMPLATES
  - Offboarding templates: remove inline seed data, use SEED_OFFBOARDING_TEMPLATES

1.4. Add NEW seeding logic for tables currently NOT seeded anywhere:
  - **WorkflowTransition**: upsert by [fromStatus, toStatus] composite key
  - **EscalationRule**: look up requestTypeId by code, then create (or use requestTypeCode→upsert pattern)

### Phase 2: Fix Entity Seed (CRITICAL)

2.1. Replace old entity seeds (CIT-MY, CIT-SG, CIT-HK) with the 5 real entities:
  ```ts
  { code: 'CG',  name: 'Citadel Group',          approverId: lookup by email }
  { code: 'CGT', name: 'Citadel Group Technologies', approverId: lookup by email }
  { code: 'CT360', name: 'Citadel Tayyib 360',   approverId: lookup by email }
  { code: 'CWP', name: 'Citadel Wealth Partners', approverId: lookup by email }
  { code: 'NIU', name: 'Niu Group',             approverId: lookup by email }
  ```

2.2. Entity approverId uses UUID — needs email→userId lookup (same pattern already used in seed.ts for admin user lookups)

### Phase 3: Fix Idempotency Gaps

3.1. **OffboardingTaskTemplate**: Change from `createMany` to per-record upsert with `taskName` as semi-key (add `orderBy: { displayOrder: asc }` for consistency)

3.2. **OnboardingTaskTemplate**: Same — switch to per-record upsert

3.3. **EscalationRule**: Since this table has no unique constraint besides `id`, use `findFirst` + condition pattern:
  `if (!existing) { create } else { skip }`

### Phase 4: Regenerate seed-admin-config.ts from LIVE DB

Before migration, run the generator to sync seed-admin-config.ts with the latest DB data. This was previously done manually but should be documented as a pre-migration step:
```bash
# Run the admin config dump script
npx tsx prisma/generate-admin-config-seed.ts
```
(The generator script needs to be created or the existing dump-db.ts adapted.)

### Phase 5: Seed Execution Order (Dependency Chain)

The seed must respect FK dependencies:

```
1. Users (admin, CEO, CFO, etc.)     ← no deps
2. ServiceDesks                      ← no deps
3. ServiceCategories                 ← → ServiceDesks
4. RequestTypes                      ← → ServiceCategories
5. WorkflowTypes + WorkflowSteps      ← no deps
6. RequestStatusDefinitions          ← no deps
7. WorkflowTransitions               ← → StatusDefinitions (fromStatus/toStatus codes)
8. Entities                          ← → Users (approverId FK)
9. NotificationTemplates             ← no deps
10. BannerConfigs                     ← no deps
11. OnboardingTaskTemplates           ← no deps
12. OffboardingTaskTemplates         ← no deps
13. EscalationRules                   ← → RequestTypes (requestTypeId FK)
14. KnowledgeBaseArticles            ← → ServiceDesks, Users
15. Link RequestTypes→WorkflowTypes  ← → RequestTypes, WorkflowTypes
```

### Phase 6: Verification

6.1. On a TEST fresh DB, run `npm run prisma:seed` and compare record counts
6.2. Run `RETAIN_ADMIN_CONFIG=true npm run prisma:seed` and verify admin config is preserved
6.3. Verify all 5 entities exist with correct approverIds
6.4. Verify all 85 workflow transitions exist
6.5. Verify all 43 banner configs exist (including 23 role="all" admin-created ones)
6.6. Verify offboarding templates = 9 (not 12)
6.7. Verify 2 escalation rules exist and link to correct request types

---

## Summary of What's Missing Today (Fresh DB Seed Would Lose)

| Data | Impact | Fix |
|---|---|---|
| 5 Entities → only 3 wrong ones seeded | HIGH — entity routing breaks | Phase 2 |
| 85 Workflow Transitions → none seeded | HIGH — workflow engine breaks | Phase 1.4 |
| 2 Escalation Rules → none seeded | MEDIUM — SLA escalation disabled | Phase 1.4 |
| 23 Admin-created Banners → lost | MEDIUM — UI banners missing | Phase 1.3 |
| 9 Offboarding Templates → 12 wrong ones seeded | LOW — admin cleanup needed | Phase 3.1 |
| Admin-edited Notification Templates → overwritten by old defaults | MEDIUM — custom emails revert | Phase 1.3 |