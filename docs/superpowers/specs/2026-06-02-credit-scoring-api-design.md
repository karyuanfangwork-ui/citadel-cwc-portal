# Credit Scoring API — Option A Design Spec

**Date:** 2026-06-02  
**Status:** Draft — pending implementation plan  
**Scope:** Expose the internal credit scoring engine as a stateful, multi-tenant B2B subscription API

---

## 1. Problem Statement

The credit assessment module contains a production-grade scoring engine (risk scoring, financial ratio analysis, bureau caps, scorecard versioning) that currently serves only internal users. External lenders and fintech parties would pay to access this engine via API. This spec covers Option A: credit scoring as a service, stateful variant.

---

## 2. What Gets Exposed

External subscribers can:

1. Create a **borrower profile** (name, type, identifiers)
2. Submit **financial statements** with ratio data for that borrower
3. Optionally submit **qualitative assessments** (management, industry, collateral scores)
4. Trigger a **score run** — get back a risk score, rating (AAA–D), and per-factor breakdown
5. Retrieve **score history** for a borrower across multiple runs

The internal credit application workflow (S1–S7, committee, approvals, documents) is **not exposed** in Option A.

---

## 3. Architecture

### 3.1 Tenant Model

A new `ApiTenant` entity is introduced:

```
ApiTenant
  id            String   (uuid)
  name          String
  apiKey        String   (hashed, unique)
  apiKeyPrefix  String   (first 8 chars, for display: "sk_live_xxxx...")
  plan          Enum     (STARTER | GROWTH | ENTERPRISE)
  isActive      Boolean
  sandboxMode   Boolean  (if true, data is isolated in sandbox, no billing)
  createdAt     DateTime
  lastSeenAt    DateTime
```

Every billable entity — `BorrowerProfile`, `FinancialStatement`, `CreditScoreRun` — gains a `tenantId` column. Queries in the service layer always scope by `tenantId`. A tenant can never read or write another tenant's data.

### 3.2 Auth Flow

```
External caller → HTTPS → API Key middleware
                           ├─ Extract Bearer token (sk_live_xxxx...)
                           ├─ Hash and lookup ApiTenant
                           ├─ Check isActive
                           ├─ Inject tenant into req.apiTenant
                           └─ Proceed to route handler
```

No JWT, no session. API key is passed as `Authorization: Bearer sk_live_xxxx...` on every request.

### 3.3 Route Namespace

All external API endpoints are mounted under a separate prefix to keep them isolated from internal routes:

```
/api/ext/v1/borrowers          POST, GET
/api/ext/v1/borrowers/:id      GET, PATCH
/api/ext/v1/borrowers/:id/financials    POST, GET
/api/ext/v1/borrowers/:id/score         POST (trigger run)
/api/ext/v1/borrowers/:id/scores        GET (history)
/api/ext/v1/usage              GET (metering summary)
```

Internal routes (`/api/v1/credit/...`) are unchanged.

### 3.4 Scoring Flow (Stateful)

```
1. POST /borrowers            → creates BorrowerProfile (tenantId scoped)
2. POST /borrowers/:id/financials → creates FinancialStatement + ratios
3. POST /borrowers/:id/score  → calls scoringService.executeScore()
                                  reads financials from DB (same as internal)
                                  writes CreditScoreRun with tenantId
                                  returns ScoreResult
```

The existing `scoringService.executeScore()` is reused directly. The key difference from internal usage: it operates on a lightweight `CreditApplication` proxy (or a direct borrower + financial lookup path) instead of requiring a full S1–S7 application.

**Decision point for implementation:** The cleanest approach is to create a minimal "external scoring application" record per score trigger — this lets `executeScore()` stay unchanged and reuse all its internal logic. The alternative (refactoring `executeScore()` to accept a borrower ID directly) risks breaking internal flows.

---

## 4. Tenant Isolation

The following tables require `tenantId`:

| Table | Notes |
|---|---|
| `BorrowerProfile` | Core identity record |
| `FinancialStatement` | Financial data per borrower |
| `FinancialRatio` | Ratio rows per statement |
| `CreditScoreRun` | Every score result |
| `CreditApplication` | Proxy application records for external tenants |
| `QualitativeAssessment` | Optional qualitative inputs |

**Enforcement strategy:** A shared `assertTenantScope(tenantId, record)` utility is called in every service method before returning or mutating a record. This is preferable to relying solely on `WHERE tenantId = ?` queries — belt and suspenders.

Internal users (JWT-authenticated) have `tenantId = null` and bypass tenant scoping. The middleware sets `req.tenantId` for external callers and `null` for internal callers.

---

## 5. Usage Metering

`CreditScoreRun` already logs every score run with a timestamp. Adding `tenantId` is sufficient to support:

- Per-tenant run counts (daily, monthly)
- Billing threshold alerts
- Plan limit enforcement (e.g., STARTER plan: 500 runs/month)

A `GET /api/ext/v1/usage` endpoint returns:

```json
{
  "plan": "GROWTH",
  "billingPeriod": { "from": "2026-06-01", "to": "2026-06-30" },
  "runsUsed": 142,
  "runsLimit": 2000,
  "runsRemaining": 1858
}
```

Metering is computed from `CreditScoreRun` aggregation — no separate counter table needed initially.

---

## 6. Sandbox Mode

Each `ApiTenant` has a `sandboxMode` flag. Sandbox tenants:

- Use a separate `tenantId` namespace (prefixed `sandbox_`)
- Score runs are not billed
- Data is purged on a rolling 30-day basis
- Return synthetic score results if no real financials are provided (optional, v2)

This lets external developers integrate and test without affecting production data or billing.

---

## 7. Response Shape

All external API responses follow a consistent envelope:

```json
{
  "ok": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-06-02T10:00:00Z"
  }
}
```

Error responses:

```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_FINANCIALS",
    "message": "No approved financial statement found for this borrower.",
    "docsUrl": "https://docs.citadel.com/errors/INSUFFICIENT_FINANCIALS"
  }
}
```

Score run response (`POST /borrowers/:id/score`):

```json
{
  "ok": true,
  "data": {
    "scoreRunId": "scr_xxx",
    "borrowerId": "bor_xxx",
    "totalScore": 72.4,
    "riskRating": "BB",
    "baseRiskRating": "BB",
    "bureauCapsApplied": [],
    "factors": {
      "financial_performance": { "score": 68, "weight": 20, "weightedScore": 13.6 },
      "leverage":              { "score": 75, "weight": 15, "weightedScore": 11.25 },
      "liquidity":             { "score": 80, "weight": 15, "weightedScore": 12.0 },
      "cashflow":              { "score": 70, "weight": 20, "weightedScore": 14.0 },
      "management":            { "score": 72, "weight": 10, "weightedScore": 7.2 },
      "industry":              { "score": 65, "weight": 10, "weightedScore": 6.5 },
      "collateral":            { "score": 60, "weight": 5,  "weightedScore": 3.0 },
      "relationship":          { "score": 78, "weight": 5,  "weightedScore": 3.9 }
    },
    "scorecardVersion": "v3",
    "runAt": "2026-06-02T10:00:00Z"
  }
}
```

---

## 8. Error Handling

| Scenario | HTTP code | Error code |
|---|---|---|
| Invalid or missing API key | 401 | `INVALID_API_KEY` |
| Tenant deactivated | 403 | `TENANT_SUSPENDED` |
| Plan limit reached | 429 | `RATE_LIMIT_EXCEEDED` |
| Borrower not found (or wrong tenant) | 404 | `BORROWER_NOT_FOUND` |
| No approved financial statement | 422 | `INSUFFICIENT_FINANCIALS` |
| No active scorecard | 409 | `NO_ACTIVE_SCORECARD` |

---

## 9. What Is NOT in Scope (Option A)

- Full credit application workflow (S1–S7)
- Document upload / OCR
- Committee approvals and signoff
- AML screening (placeholder adapter only)
- Webhooks / async callbacks
- Developer portal / API docs website
- Billing integration (Stripe etc.) — metering only, manual invoicing acceptable for v1

---

## 10. Implementation Effort Breakdown

| Work item | Estimate |
|---|---|
| `ApiTenant` Prisma model + API key hashing + middleware | 3 days |
| `tenantId` migration on 6 core tables + tenant scope utility | 1 week |
| External route namespace + controllers | 3 days |
| Scoring endpoint wiring (proxy application or direct path) | 3 days |
| Usage metering endpoint | 2 days |
| Sandbox mode flag + namespace isolation | 2 days |
| Response envelope normalization + error codes | 2 days |
| **Total** | **~4–5 weeks** |

---

## 11. Open Questions

1. **Scorecard per tenant?** Should external tenants use the same internal scorecard, or can they configure their own factor weights? (Recommendation: use internal scorecard for v1, expose per-tenant scorecard in v2.)
2. **API key rotation?** Should tenants be able to rotate keys without downtime? (Recommendation: yes, support 2 active keys per tenant.)
3. **Qualitative inputs optional?** If a caller doesn't submit management/industry/collateral scores, the engine defaults to 50 (neutral). Is this acceptable, or should we require them? (Recommendation: optional for v1, clearly documented.)
4. **Who provisions tenants?** Admin UI in the internal portal, or manual DB insert for v1?
