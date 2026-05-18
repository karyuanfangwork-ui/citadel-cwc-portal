# Credit Assessment Module — Enterprise Assessment & Implementation Blueprint

**Target system:** Citadel CWC Portal (`citadel-cwc-portal`)
**Target use:** Corporate / SME lending, Malaysia (BNM-regulated)
**Document set version:** 1.0
**Prepared:** 2026-05-18
**Audience:** Executive sponsors, Credit & Risk leadership, Compliance, IT/Engineering, Internal Audit

---

## Document Index

| # | Document | Audience |
|---|----------|----------|
| 01 | [Executive Summary](./01-executive-summary.md) | Board / ExCo |
| 02 | [Current-State Assessment](./02-current-state-assessment.md) | IT, Architecture, Audit |
| 03 | [Module Design — Future State](./03-module-design.md) | Product, BA, Engineering |
| 04 | [Credit Risk & Scoring Framework](./04-credit-risk-framework.md) | Credit, Risk, Committee |
| 05 | [AI & Automation Roadmap](./05-ai-automation.md) | Product, Risk, Compliance |
| 06 | [Compliance, Governance & Security](./06-compliance-security.md) | Compliance, CISO, Audit |
| 07 | [Safe Implementation Roadmap (12 Phases)](./07-implementation-roadmap.md) | PMO, Engineering, Ops |
| 08 | [Technical Architecture](./08-technical-architecture.md) | Architecture, Engineering, DevOps |
| 09 | [UI/UX & Workflow Recommendations](./09-uiux-workflows.md) | UX, Product, Front-end |
| 10 | [Reporting & Analytics](./10-reporting-analytics.md) | MIS, Credit MIS, ExCo |
| 11 | [Data Model — Prisma Schema Extensions](./11-data-model.md) | Engineering, DBA |
| 12 | [RACI & Governance Matrix](./12-raci-governance.md) | PMO, Steering |
| 13 | [Risk Register & Mitigation](./13-risk-register.md) | Risk, PMO, Audit |
| 14 | [Production Readiness Checklist](./14-production-readiness.md) | Ops, SRE, Release Mgr |
| 15 | [Modular Safe Enhancement Strategy](./15-modular-safe-enhancement-strategy.md) | **All — read first for delivery posture** |

---

## How to read this set

- **Decision-makers** → read 01, then jump to 07 (roadmap) and 13 (risks).
- **Credit & Risk officers** → 03, 04, 05, 09, 10.
- **Engineering** → 02, 08, 11, 14.
- **Compliance / Audit** → 04, 06, 12, 13.

Every recommendation in this document set is grounded in an audit of the existing codebase (see §02). Cited file paths use `path:line` notation for traceability.

---

## Scope boundaries

**In scope:** Corporate & SME borrower onboarding, credit application intake, financial spreading, internal credit scoring, collateral & guarantee tracking, multi-tier credit committee workflow, post-disbursement monitoring, early warning, regulatory reporting (BNM-aligned), AI augmentation with human-in-the-loop controls.

**Out of scope (v1):** Retail unsecured lending decisioning, full general ledger / core banking integration (handled by external CBS via API), treasury / market-risk capital computation, IFRS 9 ECL model engine (consumed from existing analytics if available), Islamic finance product structures (separate phase).

**Assumptions:** Booking of disbursed facilities flows to an external Core Banking System (CBS) or G/L; this module is the **origination, sanctioning and credit-monitoring system of record**, not the loan ledger.
