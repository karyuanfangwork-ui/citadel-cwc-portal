# 01 — Executive Summary

## Context

Citadel CWC Portal is a maturing enterprise service desk and CRM platform (Node/Express + Prisma/PostgreSQL + React 19). It carries a working CRM with KYC capture, a generic approval engine, audit trail, role-based access control, S3-backed document storage, SSE/email notifications, and a recently-added OpenAI-powered CRM-AI service. The platform is **a credible foundation** for a Credit Assessment Module — but **not a credit system today**.

## What we are proposing

Build a **Credit Assessment Module (CAM)** on top of the existing CWC platform to handle the end-to-end corporate/SME credit origination lifecycle: prospect → application → spreading → scoring → committee sanction → drawdown handoff → ongoing monitoring → annual review → exit. The module is purpose-built for **BNM-regulated corporate/SME lending in Malaysia** and is engineered for compliance, auditability, and human-in-the-loop control over AI assistance.

## Strategic rationale

1. **Reuse** ~60% of the existing platform (auth, RBAC, audit, file storage, approvals, notifications, CRM accounts, KYC scaffolding, AI infra). This shortens time-to-market vs. buying or building greenfield.
2. **Unify** sales (CRM) and credit (CAM) on a single platform — a single customer record, no swivel-chair between systems.
3. **Embed compliance** (BNM, PDPA, AML/CFT) from day one with audit trails, segregation of duties, and explainable AI as design constraints — not retrofits.

## Current-state at a glance (full detail §02)

| Area | Status |
|---|---|
| Authentication, RBAC, audit trail | ✅ Solid — reusable |
| CRM accounts, contacts, KYC record, PEP flag | ✅ Present but shallow (no ongoing monitoring) |
| File upload (S3, MIME allowlist, 10MB) | 🟡 Good for documents; missing AV scanning, OCR, versioning |
| Generic approval engine | 🟡 Exists but only 1:1/1:N, no conditional/matrix routing |
| Workflow / SLA engine | 🟡 Cron-driven; no durable job queue |
| Credit facility / scoring / collateral / exposure | ❌ **Entirely absent** |
| AML/sanctions screening, watchlists, ongoing monitoring | ❌ Absent (only a boolean `isPep` flag) |
| Financial statement spreading, ratios, scorecards | ❌ Absent |
| Credit committee workflow & approval matrix | ❌ Absent |
| Early warning / portfolio monitoring | ❌ Absent |
| Regulatory reporting (BNM) | ❌ Absent |

## Recommended approach

**A 12-phase, safe, phased rollout** (§07) executed over **~12–15 months** with pilot, parallel run, and hypercare stages. AI features land **only after** the deterministic credit workflow is stable in production; AI is always **advisory**, never **authoritative** at sanction stage.

## Headline risks

| Risk | Severity | Mitigation (see §13) |
|---|---|---|
| Inadequate segregation of duties between credit officer / risk / approver | 🔴 High | RBAC matrix + approval-matrix engine + maker-checker enforcement |
| AML/PEP screening relying on a manual checkbox today | 🔴 High | Integrate third-party screening provider (Refinitiv World-Check / Dow Jones / LSEG) before pilot |
| AI hallucination in credit decisioning | 🔴 High | AI = advisory only; mandatory human sanction; full prompt/response logging; explainability layer |
| Non-compliance with BNM RMiT / outsourcing guidelines | 🔴 High | DPIA, vendor due diligence, on-prem or sovereign cloud, BCM plan |
| Operational disruption during rollout | 🟡 Med | Parallel-run, pilot cohort, rollback gates at every phase |
| Document tampering / lack of integrity | 🟡 Med | Content-hash + immutable audit log + signed-URL retrieval |

## Investment headlines (order of magnitude — refine in §07)

| Item | Range |
|---|---|
| One-off build (engineering, design, BA, PM, infra) | RM 2.4M – RM 3.8M |
| 3rd-party licences (AML screening, OCR, identity verification) | RM 250K – RM 600K / year |
| Compliance & external audit | RM 150K – RM 300K (one-off) |
| Hypercare (6 months post-go-live) | RM 400K – RM 700K |
| Annual run cost (cloud, support, licences) | RM 600K – RM 1.1M / year |

## Five recommended next steps

1. **Approve scope & charter** — confirm corporate/SME-only for v1, defer retail.
2. **Stand up steering committee** — Credit Head (sponsor), Risk Head, CCO, CIO, Internal Audit (observer).
3. **Commission Phase 1 (Discovery & DPIA)** — 6-week structured discovery, BNM gap-analysis, vendor RFI for AML screening + OCR.
4. **Freeze architecture** — confirm cloud/region strategy (BNM RMiT), decide on Prisma extensions vs. separate schema, pick AI governance model.
5. **Resource the core squad** — 1 PM, 1 BA, 1 architect, 4 engineers (2 BE, 2 FE), 1 designer, 1 credit SME embedded, 1 QA, 1 DevOps. Compliance and risk on call.
