# Missing Credit Pages — Action Plan

**Created:** 2026-05-19
**Status:** Open
**Owner:** Credit module team

## Context

`CreditNav.tsx` previously linked to four pages that were never built:
`/credit/reports`, `/credit/reviews`, `/credit/disbursements`, `/credit/scorecards`.

Of these, only **Scorecards** had a working route + component. The other three
returned 404. As a stopgap (2026-05-19), the broken links were removed from
`CreditNav.tsx`. This document tracks the rebuild plan.

## Page Inventory

| Page | Spec source | Backend status | Frontend status | Permission |
|---|---|---|---|---|
| Reports | `10-reporting-analytics.md` | Partial — `reports.service.ts` exists (generic), no credit-specific endpoints | Missing | `credit:read` |
| Reviews | `03-module-design.md`, `09-uiux-workflows.md` | Missing — no `review.routes.ts`, no Prisma model | Missing | `credit:review` |
| Disbursements | `03-module-design.md`, `11-data-model.md` | Missing — no `disbursement.routes.ts`, no Prisma model | Missing | `credit:disburse` |

## Sequencing & Effort

### Phase 1 — Credit Reports (≈ 3–4 days, lowest risk)
Read-only aggregations on existing data. No new Prisma models.

**Backend**
- New `credit-reports.routes.ts` + `credit-reports.service.ts` under `/api/v1/credit/reports`.
- Endpoints:
  - `GET /portfolio-summary` — totals by status, exposure, NPL ratio
  - `GET /pipeline-aging` — applications grouped by stage × age bucket
  - `GET /approval-cycle-time` — avg days submitted→approved by product/officer
  - `GET /export?type=...&format=csv|xlsx` — gated by `credit:read` + export token (reuse existing token pattern from doc 20-smoke-test)
- All queries: respect SoD middleware, paginate, no N+1.

**Frontend**
- New `frontend/pages/credit/CreditReports.tsx` — filter bar (date range, product, officer), card grid + tables, CSV/XLSX export buttons.
- Wire into App.tsx route `/credit/reports` with `credit:read`.
- Re-add to `CreditNav.tsx` PRIMARY_ITEMS.

**Acceptance**: smoke test from doc 20 extended with report endpoint shape assertions.

---

### Phase 2 — Disbursements (≈ 5–7 days, post-approval workflow)
Needs new data model and state machine.

**Backend**
- Prisma: `Disbursement` model (id, applicationId, tranche#, amount, currency, scheduledDate, actualDate, status `PENDING|RELEASED|HELD|CANCELLED`, bankRef, releasedBy, releasedAt, holdReason).
- Migration + seed of disburse states.
- `disbursement.routes.ts`: list, create (one per approved application), release (`credit:disburse` + SoD: releaser ≠ approver), hold, cancel.
- Hook into approval workflow: on `APPROVED`, auto-create PENDING disbursement row.
- Audit log entries on every state change.

**Frontend**
- `Disbursements.tsx` list page with status tabs (Pending / Released / Held).
- Per-application drawer: release form (bank ref, value date), hold reason modal.
- Add route + nav entry behind `credit:disburse`.

**Acceptance**: SoD test in `creditLoadTest.ts` — approver cannot release; release without `credit:disburse` returns 403.

---

### Phase 3 — Periodic Credit Reviews (≈ 7–10 days, most complex)
Annual / semi-annual borrower reviews with their own approval chain.

**Backend**
- Prisma: `CreditReview` (id, borrowerId, periodStart, periodEnd, status `DRAFT|IN_REVIEW|COMPLETED|OVERDUE`, riskRatingBefore, riskRatingAfter, recommendation, completedBy, completedAt, dueDate).
- Scheduler job: nightly cron creates `DRAFT` reviews for borrowers whose `lastReviewDate + cadence < today`; marks overdue.
- `review.routes.ts`: list (filters: status, overdue, officer), get, update draft, submit, approve (uses existing approval matrix from doc 21).
- Reuse scorecard engine for risk re-rating.

**Frontend**
- `CreditReviews.tsx` queue page (My Reviews / Team / Overdue tabs).
- Detail page: borrower snapshot, financials delta vs last review, rating change, recommendation form, submit-for-approval.
- Add route + nav entry behind `credit:review`.

**Acceptance**: new runbook `26-runbook-credit-reviews.md`; cron job test; overdue alerts surfaced in CreditDashboard.

---

## Cross-cutting

- **Permissions audit**: confirm `credit:disburse` is seeded in RBAC matrix (doc 17). Add if missing.
- **Feature flags**: gate all three behind flags from doc 18 (`credit.reports`, `credit.disbursements`, `credit.reviews`) so each can ship independently.
- **Nav restoration**: as each phase ships, re-add its link to `CreditNav.tsx`. Until then, links stay removed to avoid 404s.
- **Docs**: each phase produces/updates its own runbook under `docs/credit-assessment/`.

## Tracking

- [ ] Phase 1 — Reports
- [ ] Phase 2 — Disbursements
- [ ] Phase 3 — Reviews
