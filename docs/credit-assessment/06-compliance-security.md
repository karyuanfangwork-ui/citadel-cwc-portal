# 06 — Compliance, Governance & Security

## 1. Regulatory frame (Malaysia)

| Source | Coverage |
|---|---|
| **BNM AML/CFT and Targeted Financial Sanctions for Reporting Institutions** | CDD/EDD, screening, ongoing monitoring, STR/CTR filing, recordkeeping 7y |
| **BNM Guidelines on Risk Management in Technology (RMiT)** | Tech governance, cloud, cryptography, access control, data, third-party, cyber resilience |
| **BNM Outsourcing Guidelines** | Vendor due diligence, BNM notification thresholds, exit plans |
| **BNM Related Party Transactions** | Identification, disclosure, approval restrictions |
| **PDPA 2010 (Malaysia)** | Consent, purpose limitation, security, retention, cross-border transfer |
| **Companies Act 2016 / SSM** | Verification of corporate borrowers, directors, shareholders |
| **Internal Audit Standards (IIA)** | Audit trail, evidence, three-lines model |
| **(Where Singapore is in scope)** MAS Notice 626; PDPA SG — additional overlay |

> The Personal Data Protection (Amendment) Act 2024 introduced data-breach notification and DPO obligations — incorporate into BCP and DPIA.

## 2. Compliance gap analysis (vs. current platform)

| Requirement | Today | Required | Gap |
|---|---|---|---|
| CDD on customer | One-off `CrmKycRecord` with PEP boolean | Risk-tiered CDD/EDD, refresh schedule, UBO ≥ 25% | 🔴 High |
| Sanctions/PEP screening | Manual flag | Automated screening against accredited list (BNM + UN + OFAC + EU + UK) | 🔴 High |
| Ongoing monitoring | None | Daily delta screening, adverse media, behaviour signals | 🔴 High |
| STR/CTR support | None | Workflow + filing trail | 🔴 High |
| Recordkeeping 7y | DB-default | WORM/immutable archival of decisions, KYC, evidence | 🟡 Medium |
| Data residency | Implicit | Documented; resident in MY (or BNM-notified jurisdiction) | 🔴 High |
| Cryptography | TLS + JWT | TLS 1.2+, AES-256 at rest, FLE for sensitive fields, KMS, key rotation | 🟡 Medium |
| Access control | RBAC + JWT | RBAC + MFA + SOD + maker-checker + privileged access mgmt | 🔴 High |
| Outsourcing register | None | Vendor register + DD + exit plan | 🔴 High |
| Cyber resilience (DR/BCP) | Implicit | Documented RTO/RPO, tested annually | 🔴 High |
| Audit logs | Manual call-site | Append-only, tamper-evident, end-to-end coverage | 🟡 Medium |
| DPIA | Not done | Required pre-launch | 🔴 High |
| Vendor cloud assessment | Implicit | Documented per RMiT | 🔴 High |

## 3. Governance recommendations

### Three lines of defence
- **1st line (Business)**: RM, Credit Analyst, Credit Manager.
- **2nd line (Risk & Compliance)**: Independent credit risk, AML, model risk.
- **3rd line (Internal Audit)**: Read-only assurance.

### Committees
- **Credit Committee** — sanction authority above delegated limits.
- **Risk Committee** — policy, appetite, limits, model validation.
- **Model Risk Committee** — scorecards, AI models, drift.
- **Steering / Tech Governance Committee** — RMiT compliance, change advisory.

### Policies required pre-launch
- Credit Policy (origination, scoring, approval matrix, exceptions, recoveries).
- Risk Appetite Statement.
- Model Risk Management Policy (incl. AI usage).
- AML/CFT Policy and Procedures.
- Outsourcing Policy & Register.
- BCP / DR Policy.
- Information Security Policy.
- Acceptable Use Policy (AI).
- Data Retention & Disposal Policy.
- Incident Response Policy.

## 4. Security architecture controls

### Identity & Access
- **MFA** for all credit users (TOTP or FIDO2). **Block legacy auth.**
- **SSO** via corporate IdP.
- **PAM / break-glass** for production access; session recording.
- **SOD matrix** enforced at service layer; quarterly access review.
- **Least privilege** — start from deny; permission grants reviewed.

### Data protection
- **TLS 1.2+** in transit; HSTS, secure cookies.
- **AES-256** at rest; KMS-managed keys; annual rotation.
- **Field-level encryption** for NRIC, bank acct, salary, financials (or column-level via pgcrypto where compatible).
- **Pseudonymisation** in non-prod; **DLP** on exports & email.
- **Backup encryption**; off-site retention.
- **Data residency**: production data in Malaysia or BNM-notified jurisdiction.

### Application security
- OWASP ASVS Level 2 minimum, Level 3 target.
- Input validation, output encoding, parameterised queries (Prisma covers this), CSRF on state-changing endpoints, rate limiting, replay protection on sensitive ops.
- **WAF** in front; bot protection.
- **CSP / clickjacking / XSS** controls in frontend.
- Dependency SCA in CI; **secrets scanning**.

### File upload hardening
- Increase AV to **mandatory**: ClamAV or cloud AV inline before write.
- Sandbox PDF/Office documents (e.g., Cuckoo / cloud sandbox) for high-risk types.
- Content-type sniffing + extension match enforced.
- **SHA-256** content hash stored; serve via signed URL with short TTL.
- Optional **WORM** bucket for committee-pack documents.

### Logging, monitoring, observability
- Centralised logs (e.g., OpenSearch / Datadog / Splunk); 13-month retention.
- SIEM with rules: privilege escalation, after-hours admin, repeated 4xx, KYC-bypass attempts, mass export.
- Metrics + tracing (OpenTelemetry).
- 24×7 SOC arrangement (in-house or MSSP).

### Resilience
- RTO ≤ 4h, RPO ≤ 15m for credit-decisioning data.
- Multi-AZ; cross-region DR for prod; annual DR test with tabletop + live failover.
- Backups: daily full, hourly incremental, restore tested quarterly.
- Chaos drills annually.

### Vulnerability & pen test
- SAST + DAST in CI; quarterly internal scan; **annual third-party pen test**; pre-launch pen test.
- Bug bounty (optional Phase 5+).

## 5. Audit trail requirements

- Every state-changing action: who, what, when, before, after, IP, UA, correlationId.
- Every read of sensitive PII / financial / committee paper.
- Every AI interaction (see §05 §5).
- Append-only; periodic export to immutable storage; integrity hash chain.
- Retention 7 years post-closure (longer if litigation/legal hold).

## 6. Data retention & disposal

| Data | Retention | Disposal |
|---|---|---|
| KYC and identification | 7 years post-closure | Secure erasure + certificate |
| Credit applications & decisions | 7 years | Secure erasure |
| Committee minutes | 10 years | Archive |
| Audit logs | 7 years | Archive |
| AI interactions | 7 years | Archive |
| Marketing CRM (no consent / lapsed) | Per consent | Suppression list |
| Backups | 12 months rolling | Cryptographic erasure on key destruction |

## 7. DPIA (mandatory) — to be completed in Phase 1

Cover: lawful basis, data flow, risk to data subjects, mitigations, residual risk, sign-off.

## 8. Compliance assessment summary

Without the changes above the platform **must not** launch a credit module in production. The roadmap (§07) sequences the controls into deliverables.
