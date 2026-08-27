# CWC 2.0 Project Handover Pack

**Audience:** incoming engineering, support, QA, and deployment team.

**Purpose:** one project-level entry point for operating, developing, troubleshooting, and deploying CWC 2.0. Detailed domain guides remain in the existing module packs; this document explains how they fit together.

**Repository:** `citadel-cwc-portal`
**Active branch:** `dev2.0`
**Architecture:** modular monolith with a Node.js/Express/TypeScript backend, React/Vite frontend, PostgreSQL, Redis, S3-compatible storage, ClamAV, Nginx, and background workers/schedulers.

## What the system does

CWC 2.0 is an enterprise service desk and workflow platform supporting:

- IT Support and IT asset management
- HR Services: hiring, onboarding, offboarding, leave, interviews, and screening
- Group Finance: purchase requisitions, budget proposals, and inter-company chargeback
- Configurable request forms and workflow graphs
- Approvals, delegation, SLA timers, escalation, and notifications
- Knowledge base, search, reports, insights, and announcements
- CRM
- Credit LOS as a separately bounded embedded module

## Read in this order

1. `01-team-onboarding.md` — local setup, roles, first-day checklist, and how to use the portal.
2. `02-development-and-fixes.md` — code navigation, safe change patterns, testing, and bug-fix workflow.
3. `03-deployment-and-operations.md` — production architecture, deployment, backup, rollback, health checks, and diagnostics.
4. `04-ownership-and-known-risks.md` — ownership matrix, source-of-truth rules, documentation gaps, and open operational risks.
5. `../handover-esm/00-README.md` — detailed ESM/service-management maintainer guide.
6. `../handover/00-README.md` — detailed Credit LOS maintainer guide.
7. `../runbooks/production-deployment.md` — full production deployment runbook.

## Module boundaries

| Area | Backend | Frontend | Detailed guide |
|---|---|---|---|
| ESM service management | `backend/src/routes/`, `controllers/`, `services/` | `frontend/pages/`, `frontend/src/services/` | `docs/handover-esm/` |
| Credit LOS | `backend/src/credit/` | `frontend/pages/credit/`, `frontend/src/components/credit/` | `docs/handover/` |
| CRM | `backend/src/routes/crm.routes.ts`, related controller/service | CRM pages and services | `docs/crm-module-user-guide.md`, CRM audits |
| Platform infrastructure | `backend/src/config/`, middleware, workers, Prisma | auth, API client, shared components | this pack + deployment runbook |

## Non-negotiable operating rules

- Never expose or commit `.env`, credentials, tokens, private keys, database dumps, or production PII.
- Never run destructive seed, reset, drop, or production data-clear commands against production.
- Back up production before schema/data changes; stop if the backup fails or is empty.
- Runtime request transitions are driven by published/database workflow configuration. Editing `backend/src/utils/workflowTransitions.ts` alone does not change normal runtime behavior.
- Use the central transition services rather than directly updating request/application status in a controller.
- Preserve tenant scoping, row-level authorization, audit trails, optimistic concurrency, soft-delete filters, and notification/outbox behavior.
- Production code is baked into Docker images. `git pull + docker restart` does not deploy new code; images must be rebuilt.
- Production deployment requires explicit release approval from the service owner.

## First handover meeting checklist

- Confirm repository access, GitHub permissions, server SSH access, secrets-manager access, DNS/domain ownership, S3 access, email provider access, and monitoring access.
- Walk through one end-user request from creation to closure.
- Walk through one approval and delegation scenario.
- Walk through one workflow-designer publish and rollback scenario in non-production.
- Demonstrate a safe production backup, deployment verification, and rollback decision process without executing a live change.
- Agree owners for application support, backend, frontend, database, infrastructure, security, and business workflow configuration.
