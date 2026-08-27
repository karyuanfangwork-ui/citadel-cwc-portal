# Ownership, Source of Truth, and Known Risks

## Suggested ownership matrix

| Responsibility | Primary technical area | Incoming owner to assign |
|---|---|---|
| End-user support and triage | Portal flows, request detail, notifications | Service desk lead |
| Backend/API | `backend/src/routes`, controllers, services, middleware | Backend lead |
| Frontend | `frontend/App.tsx`, pages, components, services | Frontend lead |
| Workflow configuration | Published workflow versions, nodes, edges, transitions | Workflow/business process owner |
| Database | `backend/prisma/schema.prisma`, migrations, backup/restore | Database owner |
| Infrastructure | Docker Compose, Nginx, TLS, host resources, deploy.sh | DevOps owner |
| Security/privacy | JWT/RBAC, tenant/resource scope, audit, encryption, DLP, scanning | Security owner |
| Credit LOS | `backend/src/credit`, Credit pages/components | Credit product/engineering owner |
| CRM | CRM routes/services/pages and imports | CRM product/engineering owner |

Replace these role names with named people, escalation channels, SLAs, and backup owners during the handover meeting.

## Sources of truth

- Route mounts: `backend/src/routes/index.ts`.
- Runtime configuration: `backend/src/config/index.ts` and environment configuration; values are intentionally not documented here.
- Database schema: `backend/prisma/schema.prisma` plus committed migrations.
- Request workflow behavior: published/database workflow configuration and transition services, not only the hardcoded fallback map.
- Frontend routes: `frontend/App.tsx`.
- Production deployment behavior: `deploy.sh` and `docs/runbooks/production-deployment.md`.
- Detailed ESM behavior: `docs/handover-esm/`.
- Detailed Credit behavior: `docs/handover/`.

## Known documentation and operational risks

1. The root `README.md`, `backend/README.md`, and `frontend/README.md` contain older setup/version/credential examples. Treat package manifests, `AGENTS.md`, `.env.example`, and live code as authoritative; update the older READMEs as a follow-up.
2. Production has limited memory; parallel Docker builds can cause OOM. Build backend and frontend separately.
3. A restart without image rebuild does not deploy source changes.
4. A successful health check does not prove a feature works. Always test the changed role/user journey in a browser or API smoke test.
5. General seed execution can alter reference/configuration data. Production seed must preserve admin-managed configuration and destructive seed scripts must remain blocked.
6. Migration recovery may require data inspection and backfill. Treat `db push --accept-data-loss` as an exceptional, approved recovery path, not a normal deployment step.
7. Recent production errors must be read from Docker container logs; on-disk backend logs may be old persisted development output.
8. Rate limiting can fall back to in-memory storage when Redis-backed rate limiting is not enabled; confirm the intended production setting.
10. PDF generation depends on the pinned Puppeteer/Chromium runtime and queue result-key propagation; include a PDF smoke check in releases affecting exports.
11. Tenant scope, authorization, audit-chain, and workflow invariants are security/business controls, not optional implementation details.
12. Production deployment is currently operator-driven over SSH and Docker Compose; CI/CD hardening and release-evidence improvements remain infrastructure follow-up work.
13. Health endpoints are available at `/health/live`, `/health/ready`, and `/health`, but health checks alone do not verify a changed business flow.

## Handover acceptance checklist

- [ ] Named owners, backup owners, escalation channels, and support hours recorded.
- [ ] New team can clone the repository and complete a clean local setup.
- [ ] New team can create and process representative IT, HR, and Finance requests in a test environment.
- [ ] New team understands published workflow configuration and can safely change it in non-production.
- [ ] New team can trace a bug from browser/API symptom to backend service and test.
- [ ] New team has approved access to GitHub, CI, staging, production, database backups, object storage, email, Redis, TLS, monitoring, and error tracking.
- [ ] A backup/restore exercise has been completed outside production.
- [ ] A deployment dry run and rollback dry run have been completed.
- [ ] The stale README and any unresolved risks above have assigned follow-up owners.
- [ ] The handover pack is linked from the team’s project/operations home page.
