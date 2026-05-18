# 10 — Reporting & Analytics

## 1. Dashboard catalogue

### Executive (daily refresh)
- Origination pipeline (count, value, by stage).
- Decisions (approved / declined / pending) WTD/MTD/YTD.
- Average decision turnaround.
- Portfolio outstanding by sector, rating, product.
- NPL, Stage-2 ratio, watchlist exposure.
- Top 10 single-name and group exposures.

### Credit operations
- Inbox depth and ageing (per analyst, per manager).
- SLA breach forecast.
- Maker-checker rejection rate (quality signal).
- Override frequency (scorecard, policy exception).

### Risk
- Concentration heat-maps: single counterparty, group, sector, geography.
- Migration matrix (rating movements period over period).
- EWS dashboard: signals by severity, by sector, time-trend.
- Covenant test results (passed / failed / due).
- AI model drift indicators (PSI, override rate).

### Compliance
- KYC ageing & re-KYC due.
- Screening throughput, hit rate, adjudication SLA.
- STR/CTR queue.
- Sanction list refresh log.

### Portfolio quality
- Vintage curves (default by origination cohort).
- PD vs. realised default (backtest).
- Sector quality trend.

### AI usage & governance
- Tokens, cost, latency by feature.
- Override rate per AI feature.
- Drift metrics.
- Incident log.

## 2. Real-time vs. batch

| Use | Mode |
|---|---|
| Operational inboxes | Real-time (SSE) |
| Executive KPIs | Near-real-time (15 min) |
| Portfolio analytics | Daily batch |
| Regulatory reports | Scheduled (monthly/quarterly) + on demand |
| Backtesting & model validation | Quarterly batch |

## 3. Drill-down requirements

Every dashboard tile must drill down to the underlying record(s); every export logged for DLP.

## 4. Export & DLP

- CSV / Excel / PDF.
- Export action gated by permission and reason capture.
- PII fields masked unless `credit:export:pii` permission.
- All exports watermarked with user + timestamp; recorded in audit log.

## 5. Regulatory reporting (BNM-aligned, illustrative)

| Report | Frequency | Source |
|---|---|---|
| Large exposure return | Monthly | `Exposure` + `LimitDefinition` |
| Sector exposure | Quarterly | `Exposure` |
| Connected party / RPT | Quarterly | `RelatedPartyGroup` + `Exposure` |
| NPL / impairment | Monthly | `FacilityHealth` + `CreditEvent` |
| AML statistics | Monthly | `ScreeningRun` + `ScreeningHit` |
| Stress test pack | On demand | spreading + ratings + exposure |

Each report run produces a `RegulatoryReportRun` record with hash and immutable archive copy.

## 6. Data warehouse / BI

- Replicate transactional data to a warehouse (Snowflake / BigQuery / on-prem MS SQL) via CDC (Debezium) or scheduled exports.
- BI layer (Power BI / Metabase / Tableau) for ad-hoc analytics.
- PII tokenised in warehouse; raw PII stays in OLTP under controls.

## 7. Scheduled reports

- Configurable per user / role; delivered via secure portal link (not email attachment) with link expiry.
- Schedules versioned and visible to compliance.
