# Search and Visibility Audit

## Verdict

**FAIL — Critical — P0 — Not production-ready.** Tenant and confidentiality filters exist, but the global/ticket search paths do not apply the same ownership, participant, approver and agent-team rules as request retrieval. Knowledge search is not desk-entitlement aware. User search exposes staff directory data broadly. Attachment search is absent.

## Visibility matrix

| Search surface | Authentication | Tenant | Department | Owner/resource policy | Deleted/archive | Status | Risk |
|---|---|---|---|---|---|---|---|
| Global request search | Yes | Prisma context | No | Confidentiality only | Excludes deleted | Fail | Critical |
| Ticket search | Yes | Prisma context | No | Confidentiality only | Excludes deleted | Fail | Critical |
| Request list search | Yes | Prisma context | Partial agent-team policy | Ownership/role conditions | Excludes deleted | Partial | High |
| KB search | Optional/public routes and authenticated global search | Tenant when context exists | No enforced audience | Published only | Excludes deleted | Fail | High |
| User search | Yes | Tenant context | No | `/search/users` has no role check | Active only | Fail | High |
| Attachment content search | N/A | N/A | N/A | N/A | N/A | Missing | Medium |
| API search pagination | Yes | N/A | N/A | N/A | N/A | Fail | Medium |
| CRM search | `crm:read` and CRM-specific scopes | Partial | CRM team model | Varies by endpoint | Varies | Partial | High |
| Credit search/list | Credit permission and branch/RM helpers | Partial | Not ESM desk based | Varies by controller | Varies | Partial | High |

## Critical findings

1. **SV-01 — Cross-desk request disclosure.** `search.controller.ts` returns all matching non-confidential tenant requests. Expected: reuse a single `buildRequestVisibilityWhere(principal, action)` policy. **Critical/P0/Medium/Backend Security.**
2. **SV-02 — User enumeration.** Direct user search is authentication-only and returns email, department and job title. Expected: directory entitlement, purpose limitation, minimal fields and rate limit. **High/P0/Small/IAM.**
3. **SV-03 — KB audience leakage.** Published status is treated as company-wide publication. Expected: tenant+department+role/entity audience and classification filters. **High/P1/Medium/Knowledge Product.**
4. **SV-04 — Unbounded parameters.** `page`/`limit` use raw `parseInt` and are not capped or schema validated. Expected: centralized pagination with maximums. **Medium/P1/Small/API Platform.**
5. **SV-05 — Authorization divergence.** List/detail/search/export each reconstruct different policies. Expected: one policy engine returning a query predicate plus per-object decision. **Critical/P0/Large/Security Architecture.**
6. **SV-06 — No authorization-aware index design.** Elasticsearch is configured but unused; PostgreSQL `contains` has no relevance, stemming or audience token. Expected: either remove configuration or implement an index that carries tenant, department, ACL, classification, lifecycle and deletion tombstones. **Medium/P2/Large/Search Team.**
7. **SV-07 — No attachment indexing/governance.** There is no OCR/text extraction, malware-gated indexing, ACL propagation or deletion handling. **Medium/P2/Large/Search + Security.**
8. **SV-08 — Search/frontend contract drift.** Frontend global service types an array while backend returns grouped `{requests,articles,users}`. **Medium/P2/Small/Frontend.**
9. **SV-09 — Sensitive snippets.** Results can expose request descriptions and staff metadata before a resource access check. **High/P0/Medium/Backend Security.**
10. **SV-10 — No query/privacy audit.** Sensitive HR/Finance searches are not captured for abuse monitoring. **Medium/P2/Medium/Compliance.**

## Required query policy

Every searchable document must carry `tenantId`, `departmentId`, owner, participants/approvers, classification, lifecycle, deleted/archived state and ACL version. Query authorization must be applied server-side before ranking, never after a broad result fetch. Resource retrieval must re-check policy because index ACLs can be stale.

## Acceptance tests

- For every IT/HR/Finance role, search exact UUID, reference, unique phrase, requester email and attachment filename belonging to each other desk; expect zero result.
- Repeat for confidential/non-confidential, assigned/unassigned, participant/non-participant, deleted/archived and tenant A/B records.
- Verify indexes purge/tombstone deletes and ACL changes within a defined maximum propagation delay.
- Prove limits, timeouts, query length, wildcard behavior and abuse rate limits.
