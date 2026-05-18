# 08 — Technical Architecture

## 1. Architectural style

**Modular monolith first, extract services later.** The existing CWC portal is a modular Express monolith; introducing CAM as new modules within the same monolith — but with **clear bounded contexts** and integration via in-process service interfaces — minimises operational complexity at launch. We extract `aml-screening`, `ocr`, `scoring`, and `portfolio-monitor` to independent services if scale or compliance requires.

## 2. High-level component view

```
                ┌──────────────────────────────────────────────────┐
                │                Web (React 19 + Vite)             │
                │  Credit pages • Committee app • Risk dashboard   │
                └──────────────┬───────────────────────────────────┘
                               │ HTTPS / JWT (+ MFA-bound session)
                ┌──────────────▼───────────────────────────────────┐
                │              API Gateway / WAF                   │
                └──────────────┬───────────────────────────────────┘
                               │
                ┌──────────────▼───────────────────────────────────┐
                │  CWC Portal (Express, modular)                   │
                │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
                │  │ Auth / RBAC  │ │  CRM         │ │  Service │  │
                │  │  (existing)  │ │ (existing)   │ │   Desk   │  │
                │  └──────────────┘ └──────────────┘ └──────────┘  │
                │  ┌──────────────────────────────────────────┐    │
                │  │  CAM modules (NEW)                       │    │
                │  │  borrower • application • spreading •    │    │
                │  │  scoring • collateral • exposure •       │    │
                │  │  committee • monitor • reporting         │    │
                │  └──────────────────────────────────────────┘    │
                │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
                │  │ Approval     │ │  Document    │ │ Workflow │  │
                │  │ Matrix Engine│ │  Service     │ │  Engine  │  │
                │  └──────────────┘ └──────────────┘ └──────────┘  │
                │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
                │  │ AI Orchestr. │ │  Audit       │ │ Notify   │  │
                │  │  + Guardrail │ │  Logger      │ │  (SSE/✉) │  │
                │  └──────────────┘ └──────────────┘ └──────────┘  │
                └──────────────┬───────────────────────────────────┘
                               │
        ┌──────────────────────┼────────────────────────────────────┐
        │             Async / event plane (NEW: BullMQ + Redis)     │
        │  queues: screening • ocr • scoring • monitoring • reports │
        └──────────────────────┬────────────────────────────────────┘
                               │
   ┌──────────┬───────────┬────┴─────┬───────────┬───────────┬──────────┐
   │PostgreSQL│   S3      │  KMS     │ AML/PEP   │  OCR /    │  CBS /   │
   │ (Prisma) │ (+ WORM)  │ (keys)   │ Vendor    │  Doc AI   │  G/L     │
   └──────────┴───────────┴──────────┴───────────┴───────────┴──────────┘
                               │
                          ┌────┴────┐
                          │  SIEM   │
                          │ + Obs.  │
                          │ stack   │
                          └─────────┘
```

## 3. Component choices & rationale

| Concern | Choice | Why |
|---|---|---|
| Web | React 19 + Vite | Already in place; consistent UX |
| API | Express + TS | Reuse existing platform |
| ORM | Prisma | Already used; supports migrations, middleware for auto-audit |
| DB | PostgreSQL | Existing; ACID, JSONB, partial indexes; row-level security available |
| Cache / Queue | Redis + BullMQ | Adds durable async; modest ops cost |
| Object store | S3 (or MinIO) + WORM bucket | Existing; WORM for committee packs and signed docs |
| Auth/SSO/MFA | Corporate IdP (Auth0/WSO2/Cognito) | Replace local login or front it with OIDC |
| Secrets / Keys | KMS (AWS KMS or HashiCorp Vault) | Required for FLE, key rotation |
| Observability | OpenTelemetry → Datadog/Grafana/OpenSearch | Logs, metrics, traces |
| AI | OpenAI enterprise endpoint (existing) + RAG (pgvector) | Zero-retention; region-resident; audit-friendly |
| WAF / CDN | CloudFront + AWS WAF (or equivalent) | DDoS, OWASP rules, geo block |

## 4. Data architecture

- **Single Prisma schema** with namespaced models (`Credit*`, `Borrower*`, `Collateral*`, etc.). See §11 for schema delta.
- **Row-level security** via Postgres RLS for tenant or sensitivity boundary if multi-entity.
- **JSONB** for AI outputs, scorecard run snapshots, screening hits — indexed where queried.
- **Read replicas** for reporting / portfolio dashboards.
- **Outbox pattern** for reliable event emission to external systems (CBS, BI).

## 5. Approval Matrix Engine

- Data-driven rules (`ApprovalMatrix` table) version-controlled with effective dates.
- Inputs: exposure (group basis), rating, product type, connected-party flag, exception count.
- Outputs: required authority level(s), quorum, recusal rules.
- Maker-checker enforced; recusal enforced via `excludedUserIds` derived from interest-register.

## 6. Workflow Engine

- Reuse existing `WorkflowType / WorkflowStep / WorkflowTransition`.
- Add `WorkflowGuard` and `WorkflowAction` tables to express pre/post conditions and side-effects.
- Each transition enforces RBAC, validations, and audit emission.
- Long-running tasks (re-KYC, periodic review) modelled as scheduled jobs producing tasks.

## 7. Async architecture

| Queue | Trigger | Job |
|---|---|---|
| `screening.run` | New borrower / periodic / event | Hit vendor, persist `ScreeningHit` |
| `ocr.extract` | New financial doc | Extract to `SpreadingDraft` |
| `score.run` | Spreading commit / override | Compute `ScoreRun` |
| `monitor.daily` | Cron | Compute EWS, covenant tests |
| `report.run` | Schedule / manual | Build regulatory and management reports |
| `ai.invoke` | Feature trigger | Bounded AI call w/ guardrail |
| `notify.send` | Domain event | SSE + email |

All jobs idempotent (correlationId), retry with exponential backoff, DLQ for poison messages.

## 8. Integration patterns

- **Outbound to CBS / G/L**: outbox → message → CBS adapter; reconciliation job.
- **Inbound from CBS**: payment events → `PaymentEvent` table; updates facility health.
- **AML/KYC/OCR vendors**: HTTPS APIs with mTLS where supported; circuit breakers; per-vendor adapter pattern.
- **Credit bureau (CTOS / CCRIS)**: scheduled pulls + on-demand; results stored hashed; PDPA consent enforced.
- **E-sign**: webhook → `CreditDocumentVersion` flagged signed.

## 9. Environments & promotion

- **Dev** (per developer / shared) — synthetic data only.
- **Test** (CI) — synthetic data, ephemeral.
- **UAT** — masked production-shape data; vendor sandboxes.
- **Pre-prod / DR** — production-equivalent.
- **Prod** — restricted access; PAM-gated.
- Promotion: feature flags + canary; deployment via blue/green or rolling.

## 10. CI/CD

- Pull request: lint, typecheck, unit tests, SAST, secret scan, dependency scan.
- Merge to main: integration tests, container build, image signing (cosign), SBOM, push to registry.
- Deploy: GitOps (ArgoCD/Flux) or pipeline-driven; automated DB migrations gated by approval; rollback by image tag.
- Quality gates: ≥ 80% coverage on credit-core; zero high/critical SCA; SAST clean; pen-test of last release within window.

## 11. Observability stack

- **Metrics**: app + infra; SLOs per critical journey (origination, decision, screening).
- **Tracing**: OpenTelemetry across HTTP, DB, queue, vendor calls.
- **Logs**: structured JSON; correlationId propagated.
- **Alerting**: PagerDuty / OpsGenie; runbooks linked in alerts.
- **SLO examples**: Application save p95 < 800ms; scoring run p95 < 4s; AML screening p95 < 8s.

## 12. Security architecture (see §06)

- mTLS for vendor calls where supported.
- KMS-backed FLE for sensitive columns.
- WAF, bot, rate limit at edge.
- Per-environment IAM least-privilege.
- Just-in-time prod access with session recording.

## 13. Scalability & HA

- Stateless app tier behind load balancer; horizontal autoscaling.
- Postgres: primary + sync standby + async DR; PgBouncer.
- Redis: cluster mode, AOF persistence.
- Multi-AZ; documented multi-region DR.
- Backpressure via queue depth metrics → autoscale workers.

## 14. Performance & capacity

- Target volumes (year-1): 1,000 active applications, 10,000 borrowers, 50,000 docs, 500 daily AML screens, 5,000 nightly monitor jobs.
- Capacity test at 5× target.
- Cost guardrails on AI usage (per-tenant cap; circuit breaker).

## 15. Architectural Decision Records (sample to author)

- ADR-001 Modular monolith vs. microservices.
- ADR-002 BullMQ + Redis for async (vs. SQS / Temporal).
- ADR-003 OpenAI enterprise vs. self-hosted LLM.
- ADR-004 Prisma middleware for auto-audit.
- ADR-005 FLE strategy (pgcrypto vs. KMS envelope encryption).
- ADR-006 RLS on Postgres for sensitive segregation.
- ADR-007 Outbox + idempotent consumer for CBS integration.
- ADR-008 Document AV in-pipeline vs. async quarantine.
