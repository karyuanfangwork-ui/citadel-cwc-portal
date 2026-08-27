# Development, Bug Fixes, and Release Quality

## Code navigation

The backend entry point and route registry are `backend/src/routes/index.ts` and `backend/src/index.ts`. The common backend flow is:

```text
route → middleware/validation/authz → controller → service → Prisma/database
```

The frontend route registry is `frontend/App.tsx`. The usual frontend flow is:

```text
page/component → domain service in frontend/src/services/ → Axios API client → backend endpoint
```

Shared UI and context live under `frontend/src/components/` and `frontend/src/context/`. Main operational pages are under `frontend/pages/`; authentication pages are under `frontend/src/pages/`.

## Safe change workflow

1. Reproduce the issue with a focused test, API call, or browser scenario.
2. Trace the complete contract: UI → service → route → controller → service → model/migration.
3. Identify authorization, tenant scope, workflow state, audit, notification, and concurrency effects before editing.
4. Add or update a regression test at the narrowest meaningful layer.
5. Implement the smallest change in the existing layer; keep controllers thin.
6. Run focused tests, then the package build and relevant broader suite.
7. Perform a browser smoke test for user-visible changes.
8. Review `git diff`, `git diff --check`, and changed files for secrets or unrelated edits.
9. Record migration, seed, feature-flag, and rollout implications in the change/PR description.

## Common fix patterns

### Request/workflow status bug

Start with `backend/src/services/requestTransition.service.ts`, `availableTransitions.service.ts`, workflow guards, and the published workflow records. Do not scatter direct `prisma.request.update({ status })` calls. The workflow designer/database configuration is authoritative at runtime; the hardcoded fallback map is not the normal control surface.

### Permission or missing-menu bug

Trace the backend `requirePermission()` middleware and permission loading/caching first, then the frontend route/page guard. A visible button is not authorization. Verify both allowed and denied paths, including direct API access.

### Wrong or missing records

Check tenant scoping, resource authorization, `deletedAt: null`, entity/department scope, and optimistic `version` handling. A 404 may be intentional to avoid disclosing an inaccessible record.

### Notification bug

Trace notification creation, durable outbox dispatch, email provider configuration, SSE/Redis pub-sub, and frontend subscription/reconnect behavior. Verify both the durable in-app record and delivery path.

### Attachment or download bug

Trace upload validation, S3-compatible storage, ClamAV scanning, file status, presigned download route, and access control. Do not enable local upload serving in production as a shortcut.

### PDF/export bug

Trace the PDF job route, BullMQ/Redis result key, worker, Puppeteer runtime, and frontend polling. Verify an in-container PDF smoke result rather than only a successful enqueue response.

### CRM import bug

Use the CRM-specific validators, controller/service, and import tests. Preserve existing fields and report created/skipped/failed rows. Duplicate activities are rejected using Lead ID + Activity Type + normalized Subject.

### Credit bug

Use `backend/src/credit/` and its dedicated tests/guides. Respect feature flags, RM/application row scope, MFA, segregation of duties, audit-chain immutability, encrypted fields, and immutable memo/document rules.

## Testing matrix

| Change | Minimum verification |
|---|---|
| Backend service/controller | Focused Jest test, `npm run build`, relevant integration test |
| Prisma schema/migration | Migration test on disposable DB, `prisma migrate status`, backend build, affected integration tests |
| Frontend page/service | Vitest test, `npm run build`, `npx tsc --noEmit`, browser smoke |
| Auth/RBAC | Allowed/denied API tests and direct-route browser check |
| Workflow designer/lifecycle | Published-graph test, transition guard tests, end-to-end request scenario |
| Notification/SSE/queue | Dispatcher/worker tests and a real local integration smoke |
| Production deployment change | Full local pre-flight plus deployment runbook gates |

## Pull request checklist

- [ ] Scope and affected domain are stated.
- [ ] API/frontend contract changes are synchronized.
- [ ] Authorization and tenant/resource scope are tested.
- [ ] Audit, notification, SLA, and state-transition side effects are considered.
- [ ] Migration is reversible or has a documented recovery path.
- [ ] Seed changes are safe and do not prune admin-managed production configuration.
- [ ] Tests/builds are fresh and their commands/results are recorded.
- [ ] No secrets, production dumps, or PII are included.
