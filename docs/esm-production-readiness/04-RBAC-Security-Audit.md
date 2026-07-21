# RBAC and Security Audit

## Verdict

**FAIL — Critical — P0 — No-Go.** Strong authentication primitives are undermined by global cross-tenant RBAC, no department-scoped grants, unmounted MFA step-up, raw user credential fields in API responses, and multiple object/function-level authorization gaps.

This assessment uses OWASP’s requirement that every endpoint accepting an object ID perform object-level authorization and applies Zero Trust’s continuous, resource-context decision principle. Authentication alone is never authorization.

## Authentication matrix

| Control | Current implementation | Status | Risk | Priority | Effort |
|---|---|---|---|---|---|
| Password hashing | bcrypt cost 12 | Pass | Low | P3 | Small |
| Access token | HS256, short TTL, JTI | Partial | Medium | P2 | Medium |
| Refresh token | Hashed, rotated, DB session | Partial | Medium | P1 | Small |
| Revocation | JTI/user timestamp in Redis | Partial | High if Redis unavailable | P1 | Medium |
| Cookies | HttpOnly, Secure in prod, SameSite configurable | Good | Medium | P2 | Small |
| Token in JSON/query | Login returns access token; SSE query fallback | Fail | High | P1 | Medium |
| Account lockout | Redis with in-memory fallback | Partial | Medium | P2 | Medium |
| Password reset | Hashed/expiring token, non-atomic consume | Fail | High | P1 | Small |
| MFA | TOTP implementation and middleware exist | Fail: not mounted on privileged actions | High | P0 | Small |
| SSO/SAML/OIDC | Missing | Fail | High | P0 | Large |
| SCIM/JIT lifecycle | Missing | Fail | High | P1 | Large |
| CSRF | SameSite only; no token/origin enforcement | Partial | Medium | P2 | Medium |
| Session inventory/revocation UX | Partial backend sessions | Partial | Medium | P2 | Medium |

## Authorization model assessment

| Requirement | Current implementation | Verdict |
|---|---|---|
| Role hierarchy | Flat union of roles | Partial; no explicit inheritance/deny/conflict model |
| Permission inheritance | Union across role-permission joins | Functional but global |
| Least privilege | Broad ADMIN/AGENT/executive access | Fail |
| Tenant ownership | Users/data partly tenant scoped | Fail for RBAC and platform admin |
| Department ownership | String `agentTeam` and desk code | Fail as universal control |
| Resource ownership | Implemented in selected request/credit paths | Inconsistent |
| API authorization | Route role/permission plus controller checks | Inconsistent across 876 handlers |
| Output filtering | Many explicit selects; raw user paths remain | Fail |
| Privilege escalation protection | Token revocation on role changes exists | Partial; tenant admin can alter global roles |
| SoD | Stronger in credit, weak/general ESM | Partial |
| Policy audit | General audit events | Partial; RBAC governance/evidence incomplete |

## Critical findings

### RB-01 — Cross-tenant privilege escalation through global RBAC

`Role`, `Permission`, `UserRole` and `RolePermission` have no tenant ownership and globally unique names. A tenant administrator with `admin:settings` can edit role permissions used by all tenants (`backend/prisma/schema.prisma:277-326`; `backend/src/routes/user.routes.ts`).

**Current:** global mutable authorization catalog.  
**Expected:** immutable platform permissions, tenant-owned custom roles/assignments, platform-superadmin boundary.  
**Impact:** one tenant admin can escalate users across the whole platform.  
**Critical / P0 / Large / IAM + Database.**

### RB-02 — Platform tenant control granted to ordinary tenant admins

All tenant CRUD requires only `admin:access`; `Tenant` is intentionally outside tenant scoping. **Critical / P0 / Medium / Platform IAM.**

### RB-03 — Raw credential/security fields returned by user APIs

`getAllUsers`, `getUserById` and update paths return raw Prisma User records. Allowed consumers include agents, executives, RMs, analysts and managers. The model contains `passwordHash`, `mfaSecret`, backup-code hashes and security flags. **Critical / P0 / Small / Backend Security.** Use explicit public/admin DTOs and permanently deny credential fields.

### RB-04 — HR workflow BOLA

Interview, screening, LOA, onboarding and offboarding routers are broadly authenticate-only. Controllers accept request IDs without the shared request-access policy. Any authenticated tenant user who obtains an ID can read or mutate sensitive employee records. **Critical / P0 / Large / HR Backend + Security.**

### RB-05 — Generic agent crosses desk boundaries

IT and Finance workflows authorize the generic AGENT role; ESM workflow has authenticate-only mutations. They do not prove agent team or target request access. **Critical / P0 / Large / Workflow Security.**

### RB-06 — Credit direct-ID BOLA

RM scope middleware builds a filter, but direct application GET/update/transition services fetch by ID and ignore it. Many child-resource endpoints use only broad credit permissions. **Critical / P0 / Large / Credit Security.**

### RB-07 — MFA exists but is not enforced

`requireMfa` is implemented but not mounted on approval/disbursement routes. Privileged fraud paths require only normal session credentials. **High / P0 / Small / Security.**

### RB-08 — Incomplete tenant-scoped model registry

Schema has 30 `tenantId` models, central set has 28; ApprovalPolicy and CatalogEntitlement are omitted. The “completeness” test copies the same hand-maintained list rather than deriving metadata. **Critical / P0 / Medium / Backend + DB.**

### RB-09 — File, export, activity, participant and notification IDOR/BOLA

See API audit findings API-01 through API-09. Together they permit same-tenant cross-user/cross-desk reads or writes. **Critical / P0 / Large / Backend Security.**

### RB-10 — Mass assignment can change protected properties

Only about 160 route-level validators exist for 876 handlers; selected controllers pass `req.body` to Prisma. A CRM pipeline update is a concrete example. Use strict schemas plus DTO allowlists and forbid tenant/owner/role/state fields from generic binding. **High / P1 / Large / Backend.**

## Horizontal and vertical escalation scenarios

| Scenario | Current exposure | Classification |
|---|---|---|
| IT agent reads HR request via search | Search lacks desk/access predicate | Horizontal, Critical |
| Authenticated user mutates HR screening by request ID | Auth-only route | Horizontal/functional, Critical |
| Export holder submits Finance/HR IDs | Export lacks per-object check | Horizontal, Critical |
| User reads arbitrary S3 object key | File route authenticates only | Horizontal, Critical |
| Tenant admin edits global ADMIN permissions | Global RBAC tables | Vertical/cross-tenant, Critical |
| Credit RM reads another RM application by ID | Scope filter ignored | Horizontal, Critical |
| User deletes another notification | Owner not included in mutation | Horizontal, High |
| Generic AGENT invokes Finance/IT action | No department membership check | Vertical/function-level, Critical |
| Caller mass-assigns protected field | Body allowlist absent | Vertical/cross-tenant potential, High |

## Target permission matrix

| Persona | Tenant | Department | Resource | Allowed examples | Explicit denies |
|---|---|---|---|---|---|
| Platform security admin | Platform | All by audited break-glass | IAM/tenant metadata | Tenant lifecycle, platform policies | Business-case content by default |
| Tenant admin | One tenant | Configured departments | Tenant configuration | Users, tenant roles, integrations | Other tenants; unrestricted HR/Finance content |
| Department admin | One tenant | One/more departments | Desk configuration | Catalog/workflows/SLA/agents for department | Other department config/data |
| Desk agent | One tenant | Assigned desks | Authorized requests | Queue, fulfilment actions | Other desk search/report/export |
| Approver | One tenant | Contextual | Designated approvals | Read minimum approval packet, decide | All cases in same status/role |
| Requester/participant | One tenant | Contextual | Owned/shared request | Read/comment allowed fields | Internal notes, foreign resources |
| Auditor | One tenant | Explicit scope | Immutable evidence | Read/export controlled audit | Operational mutations |

## Required remediation

1. Remove security fields from all response DTOs and disable generic file download immediately.
2. Separate platform admin from tenant/department admin identities and permissions.
3. Tenant-own roles/grants; add department membership and scoped permission grants.
4. Build one policy decision service and query-scope builder; apply it to every route/service/job/export.
5. Enforce MFA/step-up for admin, approval, export, DLP override and disbursement.
6. Add OIDC/SAML and SCIM/JIT/offboarding with enterprise conditional access.
7. Add real two-tenant/three-department PostgreSQL authorization integration tests and an independent BOLA penetration test.

## Acceptance gate

No Critical/High broken-access-control finding may remain. Every endpoint with an object identifier must have an automated negative test for foreign tenant, foreign department, foreign owner, wrong role, inactive user and stale/revoked session.
