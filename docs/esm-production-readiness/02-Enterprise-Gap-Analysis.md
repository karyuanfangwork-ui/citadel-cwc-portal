# Enterprise Gap Analysis and Top 100 Findings

## Rating method

Findings are ranked by plausible enterprise impact, exploitability/blast radius, operational likelihood and control evidence. `Critical/High/Medium/Low/Informational`, `P0–P3`, and `Small/Medium/Large/XLarge` use the requested classifications. Estimates are relative engineering program size and exclude procurement/change-management lead time.

## Audit matrix

| Category | Status | Risk | Priority | Effort | Production ready |
|---|---|---|---|---|---|
| Architecture | Partial | High | P1 | Large | No |
| Security | Fail | Critical | P0 | XLarge | No |
| RBAC | Fail | Critical | P0 | Large | No |
| Department isolation | Fail | Critical | P0 | XLarge | No |
| Tenant isolation | Partial | Critical | P0 | XLarge | No |
| Workflow/approval | Partial | High | P1 | XLarge | No |
| Request catalog/forms | Partial | Critical | P0 | Large | No |
| Notification | Partial | High | P1 | Large | No |
| Search/visibility | Fail | Critical | P0 | Large | No |
| Reporting/export | Fail | Critical | P0 | Large | No |
| Database | Partial | Critical | P0 | XLarge | No |
| Frontend/UX | Partial | High | P0 | Large | No |
| QA/release | Fail | Critical | P0 | Large | No |
| Reliability/operations | Partial | High | P0 | XLarge | No |
| Compliance/support | Partial | High | P1 | Large | No |

## Top 100 findings

| # / ID | Current implementation | Expected enterprise implementation | Business impact | Security impact | Risk | Priority | Effort | Owner | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| 1 RB-01 | Roles/permissions are global across tenants | Tenant-owned roles plus immutable platform permission catalog | Tenant autonomy and governance fail | Cross-tenant vertical escalation | Critical | P0 | Large | IAM/DB | Separate platform admin and tenant RBAC now |
| 2 RB-02 | Ordinary `admin:access` controls global Tenant CRUD | Dedicated platform-superadmin identity/policy | One admin can disrupt all tenants | Cross-tenant takeover/DoS | Critical | P0 | Medium | Platform IAM | Remove routes from tenant-admin surface |
| 3 DB-01 | 30 tenant models; central allow-list scopes 28 | Generated exhaustive scope and RLS | Policy/catalog drift | Cross-tenant read/write | Critical | P0 | Medium | Backend/DB | Add missing models and fail-closed test |
| 4 DB-02 | Tenant isolation is Prisma-only | PostgreSQL RLS plus scoped application policy | One defect affects whole tenant | No defense in depth | Critical | P0 | XLarge | DBA/Security | Implement RLS migration program |
| 5 DI-12 | Department is string/team/controller logic | Department root, memberships and resource ownership | Cannot safely add departments | No enforceable desk boundary | Critical | P0 | XLarge | Architecture | Build canonical department policy model |
| 6 RB-03 | User APIs return raw Prisma users | Explicit response DTOs excluding all auth secrets | Procurement/security rejection | Password/MFA material disclosure | Critical | P0 | Small | Backend Security | Hotfix DTOs and regression tests |
| 7 API-01 | Any authenticated user can sign arbitrary S3 key | Resource-bound file IDs and policy checks | Confidential file exfiltration | IDOR/BOLA | Critical | P0 | Medium | File/Security | Disable generic key download |
| 8 API-10 | HR routes are broadly authenticate-only | HR desk + ownership/designated actor checks | Employee process corruption | HR/PII BOLA | Critical | P0 | Large | HR Backend | Apply shared request policy to every route |
| 9 API-13 | Credit direct-ID paths ignore RM scope | Universal application/child scope service | Lending confidentiality failure | Financial/PII BOLA | Critical | P0 | Large | Credit Security | Enforce scope in service layer |
| 10 API-11 | Generic AGENT/auth-only IT/Finance/ESM actions | Desk-scoped capabilities per resource | Wrong desk changes cases | Broken function authorization | Critical | P0 | Large | Workflow/IAM | Replace broad role gates |
| 11 SV-01 | Search filters confidentiality, not access/desk | Shared authorized query predicate | HR/Finance tickets discoverable | Cross-desk disclosure | Critical | P0 | Medium | Search/Security | Reuse request visibility policy |
| 12 RD-01 | Reports aggregate every desk | Mandatory principal-derived department scope | KPI confidentiality and trust loss | Cross-desk analytics leakage | Critical | P0 | Medium | Reporting/IAM | Scope all aggregates/drill-downs |
| 13 API-02 | XLSX fetches caller-supplied IDs | Re-authorize every row/field | Bulk export leakage | BOLA/data exfiltration | Critical | P0 | Medium | Reporting/Security | Bind export to policy snapshot |
| 14 API-03 | PDF loader receives no actor | Object authorization before queue | Confidential case packet leakage | BOLA | Critical | P0 | Medium | Reporting/Security | Pass actor and allowed-field scope |
| 15 API-04 | PDF result is auth-only by job ID | Owner/scope-bound opaque job access | Another user gets download URL | Presigned URL disclosure | Critical | P0 | Small | Queue/Security | Store and verify creator/scope |
| 16 API-05 | Activity read/add checks existence only | Parent request authorization and field filtering | Timeline tampering | Cross-desk read/write | Critical | P0 | Small | Requests | Call shared policy for both endpoints |
| 17 API-06 | Any AGENT can manage participants | Desk/owner/capability + sharing policy | Confidential cases shared broadly | Horizontal privilege escalation | Critical | P0 | Medium | Requests/IAM | Restrict and audit participant changes |
| 18 API-07 | Notification read/delete by ID only | `(id,userId,tenantId)` mutation | Inbox integrity loss | Cross-user IDOR | High | P0 | Small | Notifications | Owner-filter updates/deletes |
| 19 RT-05 | CatalogEntitlement omitted central tenant scope | Tenant/department-owned entitlement/RLS | Wrong catalog shown/used | Cross-tenant configuration leak | Critical | P0 | Medium | Catalog/DB | Add scope and real integration test |
| 20 QA-01 | Backend tests: 33/149 suites fail, 226 tests | Zero-failure release gate | Unreliable releases | Security regressions untrusted | Critical | P0 | Large | QA/Engineering | Freeze release; repair baseline |
| 21 QA-02 | Frontend tests: 11/27 files fail, 13 tests | Green role/desk/browser suite | Broken user workflows | Access regressions undetected | High | P0 | Medium | Frontend QA | Fix tests and defects |
| 22 QA-03 | Lint fails with 2 errors | Enforced clean CI gate | Build promotion blocked | Weak control hygiene | High | P0 | Small | Engineering | Fix parsing/config errors |
| 23 OP-01 | Deploy script mutates live host/branch/schema and seeds | Immutable artifact promotion, reviewed migrate-deploy | Outage/data/config mutation | Migration controls bypassed | Critical | P0 | Large | DevOps/DBA | Retire unsafe deployment path |
| 24 OP-02 | Manual local logical dumps; S3 failure warns | Encrypted immutable off-site backup/PITR | Unrecoverable loss | Backup confidentiality/integrity | High | P0 | Large | DBA/SRE | Automate and monitor backup failure |
| 25 OP-03 | Single-host Compose and local volumes | Multi-AZ managed DB/Redis and replicated app | Host loss is total outage | Availability breach | High | P0 | XLarge | Infrastructure | Design tested HA topology |
| 26 WF-14 | Normal cron callbacks bypass distributed lock | Durable repeatable jobs or lock every callback | Duplicate emails/escalations | Duplicate privileged actions | High | P0 | Large | Platform | Move scheduler to workers |
| 27 WF-15 | SLA job defaults to weekday 09:00 | Per-due-item/minute timers | Multi-day breach delay | Missed security/approval deadlines | High | P0 | Medium | Platform/Product | Increase durable timer cadence |
| 28 RB-07 | MFA middleware exists but is not mounted | Enforced enrollment and step-up | Approval/disbursement fraud | Stolen-session abuse | High | P0 | Small | Security | Mount and test MFA gates |
| 29 IAM-01 | No OIDC/SAML enterprise SSO | Entra/Okta-compatible federation | Enterprise onboarding blocker | Weak conditional access | High | P0 | Large | IAM | Deliver OIDC first |
| 30 IAM-02 | No SCIM/JIT lifecycle | Automated joiner/mover/leaver | Orphan access and admin burden | Delayed deprovisioning | High | P1 | Large | IAM/HRIT | Implement SCIM and reconcile |
| 31 RT-01 | Desk slug and desk ID can disagree | Server-derived canonical classification | HR case misclassified | Confidentiality bypass | Critical | P0 | Medium | Frontend/Backend | Ignore client sensitivity flags |
| 32 RT-03 | Required dynamic fields bypass final submit | Shared conditional schema validation | Incomplete fulfilment data | Validation bypass | Critical | P0 | Medium | Forms Team | Validate at next and submit |
| 33 FE-03 | Announcement HTML rendered unsanitized | Sanitize on write/render plus CSP | User compromise/support incident | Stored XSS | Critical | P0 | Small | Frontend/Backend Security | Apply DOMPurify/server sanitizer |
| 34 FE-13 | Sensitive HR drafts stored plaintext in localStorage | No local sensitive drafts or encrypted short TTL server draft | Shared-device leakage | PII persistence | High | P0 | Small | Frontend/Privacy | Remove/clear sensitive drafts |
| 35 API-17 | Some handlers pass raw body to Prisma | Strict schemas/unknown-field rejection/DTO allowlist | Corrupted data/config | Mass assignment/tenant move | High | P1 | Large | API Owners | Inventory all 876 handlers |
| 36 IAM-03 | Password reset consumption is non-atomic | Conditional one-time transaction | Racing resets | Account takeover window | High | P1 | Small | Identity | Atomic consume+password+revoke |
| 37 IAM-04 | Access token returned in JSON; SSE query fallback | HttpOnly cookie or single-purpose stream ticket | Token handling complexity | XSS/log/history exposure | High | P1 | Medium | Identity/Frontend | Remove general token exposure |
| 38 IAM-05 | Cookie auth relies on SameSite only | CSRF token/origin checks for mutations | Unauthorized action risk | CSRF/same-site subdomain | Medium | P2 | Medium | Security | Add CSRF middleware |
| 39 DB-04 | Child FKs do not include tenant | Tenant-composite keys/FKs | Cross-tenant relational corruption | Lateral binding | High | P1 | XLarge | DBA | Migrate critical relations first |
| 40 DB-08 | Several business identifiers globally unique | Tenant-scoped uniqueness | Independent tenants blocked | Existence inference | High | P1 | Large | DBA/Product | Review each unique constraint |
| 41 DB-07 | Prisma nullable tenant fields vs DB checks/migrations | One authoritative non-null model | Test/runtime drift | Isolation assumptions unreliable | High | P1 | Medium | DBA | Reconcile migration/schema/live DB |
| 42 QA-04 | “Isolation integration” tests mock DB/expect true | Real two-tenant PostgreSQL tests | False assurance | Isolation bypass undetected | High | P0 | Large | QA/Security | Build negative endpoint matrix |
| 43 WF-01 | Transition side effects are separate writes | Transactional state/history/outbox | Stuck/inconsistent cases | Missing audit | High | P1 | Large | Backend | Refactor transition boundary |
| 44 WF-02 | Read-validate-update has no version check | Optimistic concurrency/idempotency | Double approvals | State integrity loss | High | P1 | Medium | Backend/DB | Add version/current-state predicate |
| 45 WF-03 | Many controllers write status directly | Single transition command API | Divergent behavior | Guards/audit bypass | High | P1 | Large | Workflow | Architecture test forbids direct writes |
| 46 WF-04 | Workflow definitions mutable/unversioned | Immutable published versions/snapshots | In-flight cases change | Audit non-reproducibility | High | P1 | XLarge | Product Architecture | Version workflow runtime |
| 47 WF-05 | All approval steps can be PENDING | Activated sequential tokens | Premature decisions | Approval bypass | High | P1 | Large | Approval Team | Implement WAITING/ACTIVE states |
| 48 WF-06 | `autoApproveIf` not evaluated | Typed, audited fail-closed evaluator | Incorrect approval path | Policy bypass | High | P1 | Medium | Workflow Security | Implement or remove field |
| 49 WF-07 | Approver chosen via `findFirst` | Explicit authority assignment/effective dates | Wrong approver | Privilege misrouting | High | P1 | Medium | IAM/Product | Create authority registry |
| 50 WF-08 | Delegation lacks scope/SoD/time/cycle rules | Governed time-bound delegation | Approval accountability gap | Privilege transfer abuse | High | P1 | Medium | IAM | Add policy and audit transaction |
| 51 WF-09 | Timeout auto-rejects despite “escalate” design | Configurable non-destructive escalation | Valid request wrongly rejected | Automated adverse action | High | P1 | Medium | Product | Disable auto-reject default |
| 52 WF-10 | Reminder recorded before best-effort send | Idempotent durable delivery | Missed approvals | False delivery evidence | High | P1 | Medium | Notifications | Queue reminders/outcomes |
| 53 WF-11 | Round robin/read-compute-write races | Atomic counter/row lock | Unfair load | Assignment integrity | High | P1 | Medium | Backend/DB | Atomic selection transaction |
| 54 WF-12 | SLA is one wall-clock target | Calendars, response/resolution, priority, OLA | SLA disputes | Compliance evidence weak | High | P1 | Large | ESM Product | Build policy/calendar service |
| 55 WF-13 | Escalation adds global role users as participants | Scoped duty target without access grant | Wrong teams see cases | HR/Finance leakage | Critical | P0 | Medium | Security/Product | Remove participant side effect |
| 56 NE-04 | Notification delivery is inline/best-effort | Transactional outbox and workers | Lost/delayed messages | Missed security alerts | High | P1 | Large | Platform | Implement durable notification pipeline |
| 57 NE-02 | Template lookup ignores tenant/department | Scoped locale/version fallback | Wrong template/branding | Cross-tenant content | High | P1 | Medium | Notifications | Add deterministic scoped key |
| 58 NE-03 | Request enrichment does not check recipient | Recipient-specific policy/redaction | Wrong-user message | Case data leakage | Critical | P0 | Medium | Security | Authorize every recipient |
| 59 NE-09 | No preferences/quiet hours/digests | Channel policy and mandatory exceptions | Low adoption/noise | Consent concerns | Medium | P2 | Large | Product/Compliance | Add preference center |
| 60 NE-15 | SMS/push are schema only | Real providers/receipts or remove claims | Product expectation gap | Consent/regulatory gap | Medium | P2 | Large | Product | Mark unsupported until delivered |
| 61 FE-14 | SSE does not reconnect after identity reload | Cookie-auth stream based on user state | Users miss updates | Missed approval/security event | High | P0 | Small | Frontend | Remove in-memory token dependency |
| 62 NE-11 | SSE pub/sub has no replay/backpressure | Cursor/replay/caps and HA metrics | Missed real-time events | Limited | Medium | P2 | Medium | Platform | Add replay/connection controls |
| 63 SV-04 | Search page/limit unbounded/unvalidated | Central bounded pagination | Slow queries/scraping | Resource exhaustion | Medium | P1 | Small | API Platform | Enforce max/default schema |
| 64 SV-07 | No attachment text search/ACL index | Malware-gated extraction with ACL propagation | Poor discoverability | Naive future indexing may leak | Medium | P2 | Large | Search/Security | Design authorization-aware index |
| 65 SV-06 | Elasticsearch configured but unused | Implement fully or remove | Ops/dependency confusion | Stale unsafe index risk | Low | P3 | Small/Large | Architecture | Decide one search strategy |
| 66 RD-05 | Average resolution loads all rows | SQL aggregate/materialized facts | Degrades with history | DoS exposure | High | P1 | Medium | Data Engineering | Move calculation to DB |
| 67 OP-04 | `/metrics` enabled unauthenticated by default | Network/app allowlist/auth | Monitoring data exposure | Reconnaissance | Medium | P1 | Small | SRE/Security | Enforce access in app/proxy |
| 68 OP-05 | Readiness ignores key Redis-dependent controls/S3/queues | Dependency-specific readiness/degraded policy | Bad instances receive traffic | Revocation/queue failures masked | High | P1 | Medium | SRE | Define critical dependencies |
| 69 OP-06 | No backend tracing/APM | OpenTelemetry/APM correlation | Slow incident resolution | Attack traces incomplete | Medium | P1 | Medium | SRE | Instrument critical flows |
| 70 OP-07 | No SLO/error budgets/alert rules/on-call evidence | Measurable SLOs and paging/runbooks | Unmanaged reliability | Security incidents unnoticed | High | P1 | Large | SRE/Support | Establish production operations |
| 71 QA-05 | CI omits Playwright/security/SCA/SAST/SBOM/load/restore | Layered enforced pipeline | Escaped defects | Supply-chain/API flaws | High | P1 | Large | DevSecOps | Add gated stages |
| 72 QA-06 | No coverage thresholds | Risk-based minimums/mutation/security tests | Unknown test adequacy | False assurance | High | P1 | Medium | QA | Enforce changed/critical coverage |
| 73 QA-07 | E2E uses stale routes/localStorage auth and accepts login redirect | Cookie-auth real role/desk flows | Smoke suite lies | Access defects missed | High | P0 | Medium | Frontend QA | Rewrite E2E suite |
| 74 FE-17 | Main JS chunk is 4.63 MB | Route splitting and budgets | Slow first load | Availability on constrained devices | High | P1 | Medium | Frontend | Lazy-load domains/vendor chunks |
| 75 FE-06/07 | CRM/Credit child routes inherit coarse parent guard | Per-action child route capabilities | Unauthorized UI access | Backend probing surface | High | P0 | Medium | Frontend/IAM | Guard every child/action |
| 76 FE-12 | Asset mutations/exports visible with read permission | Granular write/assign/export capabilities | Accidental asset changes | Function-level access risk | High | P0 | Small | Frontend/Backend | Align UI and API permissions |
| 77 FE-10 | Frontend renders all internal activities returned | Backend field suppression + UI capability | Private notes shown | Confidential data leakage | High | P0 | Medium | Requests | Omit internal data server-side |
| 78 SV-03 | KB publication has no audience policy | Department/role/entity entitlement | HR content visible broadly | Information leakage | High | P1 | Medium | Knowledge Product | Add classification/audience |
| 79 FE-29 | New desks require hardcoded nav/labels/policy | Metadata-driven default-deny desks | Expansion slows | Unsafe default for Legal/Risk | High | P1 | Large | Product/Frontend | Configure presentation/policy data |
| 80 API-23 | No OpenAPI/operation control metadata | Generated contract and deprecation policy | Integration/support friction | Undocumented exposure | Medium | P2 | Large | API Governance | Generate and gate OpenAPI |
| 81 API-22 | Rate-limit Redis disabled by default | Cluster-safe mandatory store | Limits multiply by replicas | Brute force/DoS weakening | High | P1 | Small | Platform | Enable/fail safe in production |
| 82 API-25 | Express accepts 50 MB JSON globally | Endpoint-specific limits | Memory pressure | Resource exhaustion | Medium | P1 | Small | API Platform | Lower default; opt up per import |
| 83 API-26 | Generic uploads not resource-bound; AV not quarantine-enforced | Registered object lifecycle and scan-before-use | Malware distribution | Unsafe content access | High | P0 | Large | File Security | Quarantine and bind ownership |
| 84 API-18 | AV callback uses one static key/no job hash binding | mTLS/signed job callback and replay defense | False scan status | Malware marked clean | High | P1 | Medium | Platform Security | Bind callback to scan job/document |
| 85 OP-08 | Containers run as root, no read-only/cap-drop | Hardened non-root images | Larger compromise blast radius | Container escape aid | High | P1 | Medium | DevOps | Harden images/runtime |
| 86 OP-09 | CI Node 22, runtime Node 20; mutable tags | Same pinned/digest runtime | Environment-only failures | Supply-chain drift | High | P1 | Small | DevOps | Align and pin versions |
| 87 OP-10 | Redis password defaults `changeme` | Required secret with managed rotation | Easy misconfiguration | Cache/token/queue compromise | High | P0 | Small | Platform Security | Remove default and validate startup |
| 88 OP-11 | Sensitive integrations can start with empty secrets; no secret manager | Typed production config + vault/KMS | Runtime feature failure | Key sprawl/weak rotation | High | P1 | Medium | Security/Platform | Adopt managed secrets |
| 89 OP-12 | No immutable image promotion/canary/auto rollback | Signed artifacts and staged deploy | Long outages/rollback risk | Untrusted artifact path | High | P1 | Large | DevOps | Build CD with approvals |
| 90 DB-09 | 132 cascade relations, one Restrict | Data-class retention/delete policy | Evidence/history loss | Audit destruction | High | P1 | Large | DBA/Compliance | Review and migrate critical cascades |
| 91 DB-10 | Soft delete on only 13 models | Consistent retention/anonymization lifecycle | Recovery inconsistency | Hidden deletion gaps | High | P1 | Large | Data Governance | Classify every model |
| 92 DB-11 | Core audit weaker than credit hash chain | Append-only tamper-evident audit/WORM | Disputed actions | Tampering/repudiation | High | P1 | Large | Compliance/Security | Extend audit integrity platform-wide |
| 93 DB-15 | 48 JSON fields hold governed business data | Schemas/constraints/normalization | Reporting/data quality weak | Type/field validation gaps | Medium | P2 | Large | Domain/Data | Normalize high-value facts |
| 94 ESM-01 | Asset registry is not a CMDB | CI classes/relationships/service impact | No impact analysis | Limited | Medium | P2 | XLarge | ITSM Product | Build only if business requires |
| 95 ESM-02 | No Incident/Problem/Change/Major Incident practices | ITIL-aligned modules or explicit product scope | Cannot claim full ITSM | Governance gaps | High | P1 | XLarge | ESM Product | Prioritize Incident/Change first |
| 96 RD-08 | No scheduled/saved governed reports/drill-down layer | Versioned report definitions/recipients | Manual executive reporting | Future scheduled leakage risk | Medium | P2 | Large | Reporting | Build after isolation layer |
| 97 RD-09 | ESM exports lack DLP/watermark/expiry/audit depth | Classified, expiring, audited export | Uncontrolled copies | Data loss | High | P1 | Large | Security/Compliance | Reuse credit DLP patterns |
| 98 FE-23 | Localization is English-only/hardcoded | Locale/timezone/currency/template governance | Global adoption barrier | Deadline misunderstanding | Medium | P2 | Large | Product | Internationalize critical flows |
| 99 FE-30 | Privacy/Terms links are “Coming soon” | Approved privacy/terms/retention/support notices | Compliance/procurement blocker | Transparency gap | Medium | P1 | Medium | Legal/Compliance | Publish before production |
| 100 OP-13 | No complete support model/runbooks/capacity/failover evidence | L1–L3 ownership, runbooks, SLOs, drills and exit criteria | Production incidents unmanaged | Security response delay | High | P0 | Large | Operations Leadership | Establish go-live operating model |

## Quick wins (first 10 business days)

1. Disable generic S3 key download and unauthorised PDF/XLSX routes until fixed.
2. Remove all authentication/MFA/password fields from user responses.
3. Add owner predicates to notification mutations and request access checks to activities/participants.
4. Mount MFA on privileged credit/admin/export actions.
5. Sanitize announcement HTML and remove sensitive localStorage drafts.
6. Enable Redis rate limiting and scheduler singleton fail-safe in production.
7. Remove `changeme`/empty production secret defaults and expose `/metrics` only to monitoring.
8. Repair test/lint baseline; block merges/releases on red gates.
9. Fix SSE reload and rewrite stale E2E authentication/routes.
10. Add missing tenant-scoped models while the RLS program is designed.

## Critical blockers

The first 33 findings include active access-control, isolation, credential exposure, unsafe deployment/DR and release-quality blockers. Go-live cannot be approved through compensating documentation alone; each must be closed in code/configuration, demonstrated with negative tests, and independently validated.
