# 12 — RACI & Governance Matrix

## 1. RACI key
**R** = Responsible · **A** = Accountable · **C** = Consulted · **I** = Informed

## 2. Programme-level RACI

| Activity | Sponsor (Exec) | Credit Head | Risk Head | CCO | CIO/CTO | CISO | Internal Audit | PMO | Vendor |
|---|---|---|---|---|---|---|---|---|---|
| Programme charter | A | C | C | C | C | I | I | R | — |
| Credit Policy ratification | I | R | A | C | I | I | I | I | — |
| Risk appetite | A | C | R | C | I | I | I | I | — |
| Model risk governance | I | C | R/A | C | C | I | I | I | — |
| DPIA & RMiT compliance | I | C | C | A | R | C | I | R | C |
| Vendor due diligence | I | C | C | C | R | C | I | A | C |
| AML/CFT framework | I | C | C | R/A | I | I | I | I | — |
| Architecture sign-off | I | C | C | C | R/A | C | I | I | C |
| Security sign-off | I | I | C | C | C | R/A | I | I | C |
| UAT sign-off | I | R/A | C | C | C | I | I | R | — |
| Pilot go-live decision | A | R | R | R | R | R | I | R | C |
| Full prod go-live | A | R | R | R | R | R | I | R | C |
| Hypercare exit | I | R | C | C | R/A | C | I | R | — |
| AI feature enablement (per feature) | I | C | C | C | C | C | I | R/A | — |
| Periodic backtesting | I | I | R/A | C | C | I | I | I | — |
| Annual model validation | I | C | R/A | C | C | I | I | I | — |

## 3. Operating governance forums

| Forum | Cadence | Decisions |
|---|---|---|
| Steering Committee | Monthly | Scope, budget, risks, gate sign-offs |
| Risk & Compliance Working Group | Bi-weekly | Control design, regulatory alignment |
| Tech Design Authority | Weekly | ADRs, architecture changes |
| Model Risk Committee | Quarterly | Scorecard, AI models, validation |
| Change Advisory Board | Weekly | Production change approvals |
| War-room (pilot/hypercare) | Daily | Defect triage, KPI review |

## 4. Three lines of defence mapping

| Line | Function | CAM responsibility |
|---|---|---|
| 1st | Business (RM, CA, CM, Senior, Committee) | Apply credit policy; make decisions; capture evidence |
| 2nd | Credit Risk, AML/Compliance, Model Risk | Independent review, monitoring, validation, policy custody |
| 3rd | Internal Audit | Periodic assurance; read-only access; control testing |

External: Regulator (BNM), External Auditor.

## 5. Approval authority cross-reference

See §04 §4 for credit decision authority matrix. Programme/change approvals follow IT governance; data-model and policy changes require Risk Committee.

## 6. Documentation expected at gate reviews

Every gate produces: meeting minutes, decision log, evidence pack, risk register update, KPI snapshot, dependencies & blockers, sign-offs.
