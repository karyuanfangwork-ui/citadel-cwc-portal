# Notification Engine Audit

## Verdict

**Partial — High risk — P1 — Not production-ready.** In-app notification, SSE and email are functional foundations. Delivery is synchronous/best-effort, has no durable retry/outbox/DLQ, no user preference or localization policy, and contains an ownership IDOR in notification mutations. SMS and push exist only as template/schema concepts.

## Channel matrix

| Channel | Current implementation | Status | Risk | Priority | Effort | Ready |
|---|---|---|---|---|---|---|
| In-app | Persisted `Notification`, pagination/unread | Partial | High | P0 | Small | No |
| SSE | Cookie/header/query auth, Redis pub/sub, heartbeat | Partial | Medium | P1 | Medium | Conditional |
| Email | Resend, HTML/text templates, global toggle | Partial | High | P1 | Large | No |
| SMS | Fields/enums only | Missing | Medium | P2 | Large | No |
| Mobile/web push | Fields/enums only | Missing | Medium | P2 | Large | No |
| Role targeting | Callers resolve users ad hoc | Partial | High | P1 | Medium | No |
| Department targeting | No canonical department policy | Fail | Critical | P0 | Medium | No |
| Duplicate prevention | `notifyMultiple` deduplicates within one call only | Fail | High | P1 | Medium | No |
| Retry/DLQ | None for business notifications | Missing | High | P1 | Large | No |
| Failure handling | FAILED email record; exceptions swallowed | Partial | High | P1 | Medium | No |
| Preferences/quiet hours | None | Missing | Medium | P2 | Large | No |
| Localization/timezone | None | Missing | Medium | P2 | Large | No |
| Audit/delivery evidence | Basic notification rows | Partial | Medium | P1 | Medium | No |

## Findings

| ID | Current implementation | Expected enterprise implementation | Business impact | Security impact | Risk | Priority | Effort | Owner |
|---|---|---|---|---|---|---|---|---|
| NE-01 | Mark-read/delete mutate by notification ID only (`notification.controller.ts`) | Require `(id,userId,tenantId)` and return 404 for foreign IDs | Inbox corruption | Cross-user IDOR | High | P0 | Small | Backend Security |
| NE-02 | Template lookup uses only `eventType` | Select tenant+department+locale+version with deterministic fallback | Wrong branding/content | Cross-tenant template collision | High | P1 | Medium | Notification Platform |
| NE-03 | Request enrichment loads by ID without checking recipient access | Re-evaluate policy for every recipient and redact by classification | Wrong person receives case data | HR/Finance summary leakage | Critical | P0 | Medium | Security |
| NE-04 | In-app create, SSE and provider send occur inline | Transactional outbox and durable workers | API latency; lost events | Missing audit/security alerts | High | P1 | Large | Platform |
| NE-05 | Top-level catch logs and swallows failure | Retry policy, exponential backoff, DLQ, operator replay, alerting | Silent business communication failure | Approval/SLA notices missed | High | P1 | Large | Platform/SRE |
| NE-06 | No event idempotency key | Unique event-recipient-channel key and deduplication window | Duplicate emails/inbox noise | Alert fatigue | High | P1 | Medium | Backend |
| NE-07 | Failed email stores generic error only | Provider message ID, attempt count, next retry, terminal reason | Poor support diagnostics | Weak evidence | Medium | P1 | Medium | Notification Team |
| NE-08 | Role/department recipients are resolved by callers | Central recipient-policy service with tenant/desk/classification | Inconsistent targeting | Notification leakage | Critical | P0 | Large | IAM + Product |
| NE-09 | No user preferences, consent, digest or quiet hours | Per-event/channel policy with mandatory-event exceptions | Poor adoption | Regulatory/consent exposure | Medium | P2 | Large | Product/Compliance |
| NE-10 | No locale/timezone selection | Versioned localized templates and locale-aware formatting | Confusing communications | Misinterpreted deadlines | Medium | P2 | Large | Product |
| NE-11 | SSE pub/sub is ephemeral and degrades process-local | Inbox cursor/replay; connection caps/backpressure; HA validation | Missed real-time updates | Limited | Medium | P2 | Medium | Platform |
| NE-12 | Query-token SSE remains available | Cookie or short-lived single-purpose stream ticket only | Token support burden | URL/history/proxy exposure | Medium | P1 | Small | Security |
| NE-13 | Frontend requires in-memory access token after reload even though cookie auth exists | Open SSE when identity exists; use cookie transport | Real-time silently broken after reload | Users miss security/workflow alerts | High | P0 | Small | Frontend |
| NE-14 | No notification service SLO/metrics | Delivery latency/success/retry/DLQ dashboards and paging | Incidents invisible | Alert failure invisible | High | P1 | Medium | SRE |
| NE-15 | SMS/push template fields can imply delivery capability | Mark unsupported or implement provider, consent and delivery receipts | False product expectation | Compliance gap | Medium | P2 | Large | Product |

## Required design

`Business transaction -> outbox(eventId, tenantId, departmentId, classification, recipients policy) -> durable channel workers -> provider receipt/status -> retry/DLQ -> operator replay`. Recipient expansion must occur in tenant/department context, and every notification carrying a resource link must re-check access at creation and again when opened.

## Acceptance gate

- Cross-user notification mutation tests return 404/403.
- IT/HR/Finance targeting matrix proves zero foreign-desk delivery across in-app, SSE and email.
- Crash/restart and provider-failure tests prove eventual delivery, deduplication and terminal alerting.
- Per-channel preference, mandatory event, locale, quiet-hour and retention rules are documented and tested.
- Dashboard exposes success rate, p95 delivery latency, retries, DLQ age and oldest unsent event.
