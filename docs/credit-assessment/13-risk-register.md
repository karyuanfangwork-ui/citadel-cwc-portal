# 13 — Risk Register & Mitigation

Severity scale: 🔴 High · 🟡 Medium · 🟢 Low
Likelihood (without mitigation): H/M/L

## 1. Programme & delivery risks

| # | Risk | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|
| P1 | Scope creep extends timeline | 🟡 | H | Locked charter; change-control board; staged backlog | PM |
| P2 | Key resource turnover | 🟡 | M | Cross-training; documented runbooks; vendor backfill | PM |
| P3 | Vendor lead time delays integration | 🟡 | M | Early procurement; sandbox access pre-Phase 5; fallback vendor identified | Procurement |
| P4 | Regulatory change mid-build (BNM) | 🟡 | M | Quarterly horizon-scan; compliance liaison; modular controls | CCO |
| P5 | Stakeholder misalignment | 🟡 | M | Active sponsor; steering cadence; RACI clarity | Sponsor |

## 2. Operational & user-adoption risks

| # | Risk | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|
| O1 | RM/analyst resistance to new tool | 🟡 | H | Co-design; pilot champions; training; UX investment | Change Lead |
| O2 | Disruption to live business | 🔴 | M | Parallel run; pilot; rollback; feature flags | PM |
| O3 | Data migration errors from legacy | 🟡 | M | Migration framework with reconciliation reports; dual-read fallback | Data Lead |
| O4 | SLA breach during hypercare | 🟡 | M | Defect SLA; war room; rollback playbook | Ops |
| O5 | Document backlog at pilot | 🟢 | M | Bulk-upload tooling; phased onboarding | Ops |

## 3. Credit & risk-management risks

| # | Risk | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|
| C1 | Inadequate segregation of duties | 🔴 | H | Permission matrix; maker-checker; access reviews quarterly | CISO + Credit Head |
| C2 | Scorecard miscalibration | 🔴 | M | Quarterly backtest; champion-challenger; validation by 2nd line | Risk Head |
| C3 | Override misuse | 🟡 | M | Mandatory justification; senior sign-off; monthly review | Credit Head |
| C4 | Conflict of interest in committee | 🔴 | M | Interest register; system-enforced recusal | Credit Head |
| C5 | Exposure miscalculation due to data lag | 🟡 | M | Real-time recompute; reconciliation against CBS | Risk Head |
| C6 | Collateral over-valuation | 🟡 | M | Independent valuers; haircuts; revaluation schedule | Credit Head |
| C7 | Connected-party exposure undetected | 🔴 | M | Group structure mapping; periodic UBO refresh; AI duplicate-detection | CCO |

## 4. Compliance & regulatory risks

| # | Risk | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|
| K1 | AML/PEP false-clear | 🔴 | M | Mandatory human adjudication; dual review on HIGH match score; quarterly QA sample | CCO |
| K2 | PDPA breach via export | 🔴 | M | DLP; export logging; permission gating; tokenisation in lower envs | CISO |
| K3 | Late STR/CTR filing | 🔴 | M | SLA-tracked queue; automatic reminders; escalation | CCO |
| K4 | Records-retention failure | 🟡 | M | WORM archive; retention policy enforcement; periodic audit | CCO |
| K5 | Outsourcing non-disclosure to BNM | 🔴 | M | Vendor register; legal review; BNM-notify per guideline | CCO |
| K6 | Cross-border data transfer | 🟡 | M | Data residency review; vendor contracts; encryption | CISO |

## 5. Security & technology risks

| # | Risk | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|
| S1 | Credential theft / account takeover | 🔴 | M | MFA; SSO; session security; phishing-resistant factors for privileged users | CISO |
| S2 | Insider threat (privileged misuse) | 🔴 | M | PAM; session recording; UEBA; quarterly access review | CISO |
| S3 | Document with malware uploaded | 🔴 | M | AV inline; quarantine; sandbox for high-risk types | CISO |
| S4 | Data exfiltration via API | 🔴 | M | Rate limit; anomaly detection; egress monitoring | CISO |
| S5 | SQL injection / OWASP flaws | 🟡 | L | SAST/DAST; parameterised queries (Prisma); pen-test | CISO |
| S6 | Loss of audit log integrity | 🔴 | L | Append-only; hash chain; off-cluster sink | CISO |
| S7 | DR / data loss | 🔴 | L | Backups; tested restore; RTO/RPO enforcement | CIO |
| S8 | DDoS | 🟡 | M | WAF; CDN; rate limit; provider scrubbing | CIO |
| S9 | Supply-chain (dependency) compromise | 🟡 | M | SCA; SBOM; signed images; pinned versions | CISO |

## 6. AI-specific risks

| # | Risk | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|
| A1 | AI hallucination influences decision | 🔴 | H | Advisory-only; explainability; human accountability; override capture | Risk Head |
| A2 | Prompt injection via uploaded docs | 🔴 | M | Input sanitisation; tool allowlist; isolated RAG corpus | CISO |
| A3 | Sensitive data leaked to vendor | 🔴 | M | Field redaction; zero-retention endpoint; vendor DPA | CISO + CCO |
| A4 | Model drift unnoticed | 🟡 | M | Drift metrics; alarms; quarterly review | Risk Head |
| A5 | Vendor model change without notice | 🟡 | M | Pinned model version; regression suite in CI; vendor SLA | CIO |
| A6 | Bias against protected categories | 🔴 | M | Bias audits; protected-attribute exclusion in scorecard; explainability | Risk Head + CCO |
| A7 | Over-reliance by users | 🟡 | H | UI guardrails; training; periodic shadow-review | Change Lead |

## 7. Risk treatment summary

| # | Treatment |
|---|---|
| All 🔴 risks | Mitigate to ≤ 🟡 before pilot go-live |
| All 🟡 risks with H likelihood | Mitigation plan in execution before full prod |
| Accepted risks | Documented with sponsor sign-off and review date |

## 8. Risk reporting

- Monthly risk dashboard to Steering.
- Quarterly attestation by control owners.
- Risk-and-issue log maintained in PMO toolset; mirrored in audit-ready evidence pack.
