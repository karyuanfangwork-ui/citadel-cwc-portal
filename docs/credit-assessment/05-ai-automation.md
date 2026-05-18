# 05 — AI & Automation Roadmap

The platform already runs OpenAI-powered CRM features (`backend/src/services/crm-ai.service.ts`). CAM extends this with **bounded, auditable, human-in-the-loop AI**. The cardinal rule: **AI proposes, humans dispose.**

## 1. Governance principles

1. **Advisory by design** — no AI output can directly cause a sanction, decline, or money movement.
2. **Explainability** — every AI output must be accompanied by a structured rationale that names the inputs it considered.
3. **Audit-grade logging** — full prompt + model version + parameters + response stored against the source record for ≥ 7 years.
4. **Versioning** — every prompt template and model version is recorded in a `AiPromptVersion` registry; outputs link to the version that produced them.
5. **Human override capture** — when a human overrides AI, the override reason is mandatory and reviewed monthly.
6. **Bias & drift monitoring** — outputs sampled and reviewed; metrics tracked.
7. **Data minimisation** — only the fields necessary for the prompt are sent; PII redacted/tokenised; financials masked where possible.
8. **No external training contribution** — vendor contract must include "no training on our data" clause; prefer enterprise/zero-retention endpoints.

## 2. Feature catalogue

For each: business benefit · ops impact · complexity (L/M/H) · infra · data · compliance · explainability · override · risk · phase · governance.

### A1. AI Document Classifier
- Benefit: Auto-tag uploads (financials, KYC, collateral docs, signed letter).
- Impact: Speeds up indexing; reduces misfiling.
- Complexity: M. Infra: vision-capable LLM. Data: doc OCR + filename. Compliance: low. Explainability: confidence + alternatives. Override: human re-classify. Risk: low. Phase: 2. Governance: monthly QA sample.

### A2. OCR + Financial Statement Extraction
- Benefit: 60–80% reduction in manual spreading time.
- Impact: Analyst becomes reviewer not data entry.
- Complexity: H. Infra: Azure Document Intelligence or AWS Textract for OCR; LLM for canonical mapping. Data: financial PDFs. Compliance: source PDF retained; field-level provenance to PDF coordinates. Explainability: each extracted field links to PDF region. Override: analyst edits. Risk: medium (extraction errors). Phase: 3. Governance: dual review until 99% accuracy on test set.

### A3. AI Bank Statement Analyser
- Benefit: Cash-flow trend, salary credits, bounced cheques, gambling/unusual patterns.
- Complexity: H. Infra: structured parser + LLM. Data: bank statement PDF/CSV. Compliance: PDPA, retention. Explainability: highlights specific transactions. Override: analyst flags. Risk: medium. Phase: 3.

### A4. AI Risk Narrative Summary
- Benefit: One-page narrative drafted for credit memo.
- Complexity: M. Data: application + spreading + scorecard + exposures. Compliance: human author of record is the analyst. Explainability: cites which fields. Override: analyst edits before submission. Risk: medium (over-confidence). Phase: 2.

### A5. AI Red-Flag Detector
- Benefit: Surface anomalies the analyst may miss (revenue spike inconsistent with payroll, related-party flows, sudden gearing).
- Complexity: M. Data: spread + cash flow + ratios. Explainability: rule-like flags with evidence. Override: dismiss with reason. Risk: medium. Phase: 2.

### A6. Duplicate Borrower Detection
- Benefit: Catch same SSM / NRIC / address / phone re-applying.
- Complexity: L–M. Approach: deterministic + embedding similarity. Data: borrower master. Explainability: high (named match basis). Override: confirm/dismiss. Risk: low. Phase: 2.

### A7. AML/PEP/Sanctions Screening Adjudication Assist
- Benefit: Summarise hits and suggest tier (likely-match vs. likely-not).
- Complexity: M. Data: provider hit + customer record. Compliance: HIGH — must keep human adjudication unambiguous. Explainability: side-by-side fields. Override: required — human must adjudicate. Risk: HIGH — false-clear is regulatory failure. Phase: 3 (after manual baseline established).

### A8. Adverse Media Aggregator
- Benefit: Continuous monitoring of news for portfolio.
- Complexity: M–H. Infra: feed + LLM classifier. Data: borrower names + UBO names. Compliance: PDPA. Explainability: source link, snippet. Override: analyst reviews. Risk: medium. Phase: 4.

### A9. Predictive Default / Migration Model
- Benefit: Forward-looking PD adjustment.
- Complexity: H. Approach: statistical model (logistic/gradient boosting) + LLM summary. Data: portfolio history. Compliance: model risk governance. Explainability: SHAP-style feature attribution. Override: not applicable to model; applies to scorecard adjustment. Risk: medium-high. Phase: 5+ (after sufficient data).

### A10. AI Recommendation Engine (limit suggestion)
- Benefit: First-pass limit suggestion.
- Complexity: M. Data: spread + collateral + policy. Explainability: factor weights. Override: mandatory human decision. Risk: medium. Phase: 3.

### A11. Smart Approval Suggestions
- Benefit: Propose terms (tenor, pricing, covenants).
- Complexity: M–H. Risk: HIGH if used naively — must not feel authoritative. Phase: 4.

### A12. Credit Officer Copilot Chat
- Benefit: Q&A grounded in application + policy.
- Complexity: M. Infra: RAG over policy docs + application facts. Compliance: scope-limited retrieval. Risk: medium. Phase: 3.

### A13. AI Compliance Checks
- Benefit: Detect missing KYC fields, expired docs, policy non-conformance.
- Complexity: M. Risk: low–medium (false negatives are dangerous — pair with deterministic checks). Phase: 2.

### A14. Smart Document Validation
- Benefit: Validate that uploaded doc matches expected type and has required fields.
- Complexity: M. Phase: 2.

### A15. Auto-exception Detection
- Benefit: Flag application combinations outside policy.
- Complexity: L (rules-first; AI augments). Phase: 1–2.

### A16. Portfolio Trend Prediction
- Benefit: Forward-looking concentration & deterioration.
- Complexity: H. Phase: 5.

## 3. What MUST remain human-controlled

- **Sanction decisions** at every authority tier.
- **Scorecard / rating overrides.**
- **AML hit adjudication (clear / refer / true match).**
- **Decline and write-off decisions.**
- **Policy exception approvals.**
- **Disbursement releases.**
- **Watchlist promotion / de-promotion.**

## 4. What can be safely automated (deterministic, not generative)

- Ratio computation.
- Limit checks.
- Document checklist enforcement.
- Schedule generation (re-KYC, periodic review, covenant tests).
- Notifications.
- Audit log writes.

## 5. AI guardrails — mandatory technical controls

| Control | Implementation |
|---|---|
| Prompt registry | `AiPromptVersion` table; versioned with diff history |
| Output log | `AiInteraction` table: input hash, model, params, output, tokens, latency, cost, user, correlationId |
| PII redaction in prompt | Tokenise NRIC, account numbers, names where unnecessary |
| Output schema enforcement | JSON-schema validation; reject malformed |
| Allowlisted tools | Function-calling tools restricted to read-only fact lookups |
| Rate & cost limit | Per-user and per-tenant caps; circuit-breaker |
| Sandbox eval | Pre-prod regression suite of golden prompts; CI gate |
| Human-override capture | `AiOverride` table linking AI suggestion → human decision + reason |
| Drift monitor | Daily metric: % overrides, sentiment of overrides, output distribution |
| Vendor isolation | Enterprise endpoint, zero retention, regional data residency |

## 6. Phasing summary

| Phase | AI features |
|---|---|
| 0 (pre-build) | Define governance; charter Model Risk Committee |
| 1 (MVP) | Deterministic rules only; no GenAI in credit path |
| 2 | A1, A4, A5, A6, A13, A14, A15 (low-risk advisory) |
| 3 | A2, A3, A7 (high-value but riskier — gated by accuracy SLOs) |
| 4 | A8, A11 |
| 5+ | A9, A16 (predictive models — needs portfolio data history) |
