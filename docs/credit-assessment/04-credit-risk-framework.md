# 04 — Credit Risk & Scoring Framework (Corporate / SME, Malaysia)

## 1. Principles

1. **Defensibility** — every rating decision must be reproducible and traceable to inputs and weights.
2. **Champion–challenger** — the live scorecard (Champion) is monitored against alternatives (Challenger) before promotion.
3. **Human override allowed, never silent** — overrides require documented justification and senior sign-off.
4. **AI advisory only** — AI may suggest, never decide.
5. **Versioned & immutable** — every scorecard, weighting, and run is versioned; results are immutable.

## 2. Rating scale (illustrative)

| Internal Rating | PD band (1Y) | Description |
|---|---|---|
| AAA | < 0.05% | Exceptional; minimal risk |
| AA  | 0.05–0.15% | Very strong |
| A   | 0.15–0.40% | Strong |
| BBB | 0.40–1.00% | Adequate; investment-grade boundary |
| BB  | 1.00–3.00% | Speculative; close monitoring |
| B   | 3.00–8.00% | Weak; heightened risk |
| CCC | 8.00–20.0% | Vulnerable |
| CC  | 20–40% | Highly vulnerable |
| C   | > 40% | Near default |
| D   | 100% | Default / non-performing |

Mappings to ECL stages (IFRS 9): AAA–BBB → Stage 1, BB–B → Stage 2 if SICR triggered, CCC–D → Stage 3.

## 3. Scorecard architecture

A scorecard = ordered set of **factor groups → factors → metrics → scoring bands → weights** producing a 0–100 composite, mapped to rating bands.

### Factor groups & indicative weights (SME corporate)

| Group | Weight | Sub-factors |
|---|---|---|
| Financial — Profitability | 15% | Gross margin, operating margin, ROE, ROA |
| Financial — Leverage | 15% | DE, gearing, total liabilities / EBITDA |
| Financial — Liquidity | 12% | Current, quick ratio, working capital cycle |
| Financial — Debt service | 18% | DSCR, ICR, operating CF / total debt |
| Business — Quality | 10% | Years in operation, mgmt experience, governance |
| Business — Market position | 8% | Customer concentration, supplier concentration, market share |
| Industry & Country | 7% | Industry risk band, country risk |
| Behavioural | 10% | CCRIS / payment history, prior facility conduct |
| Collateral & Structure | 5% | LTV, collateral type quality, structural protections |

Adjustments (additive, capped): qualitative analyst overlay ±5; **mandatory red-flag downgrade** if any of: PEP unresolved, sanctions hit unresolved, adverse media unresolved, fraud indicators, material covenant breach.

### Scoring bands (example — DSCR)

| DSCR | Band score |
|---|---|
| ≥ 2.0 | 100 |
| 1.5 – 1.99 | 80 |
| 1.25 – 1.49 | 60 |
| 1.0 – 1.24 | 40 |
| 0.85 – 0.99 | 20 |
| < 0.85 | 0 (with cap on overall rating ≤ BB) |

## 4. Approval authority matrix (illustrative — to be ratified by Board)

| Exposure (group basis) | Rating ≥ BBB | Rating BB / B | Rating ≤ CCC |
|---|---|---|---|
| ≤ RM 500K | Credit Manager | Senior Credit Officer | Committee |
| RM 500K – RM 5M | Senior Credit Officer | Committee | Committee + Risk Head |
| RM 5M – RM 25M | Committee | Committee + Risk Head | Board Risk Committee |
| > RM 25M | Board Risk Committee | Board Risk Committee | Board |
| Related-party / connected | Always one tier higher than table | | |

Quorum for Committee: ≥ 3 voting members including ≥ 1 risk function; chair has casting vote; recusal mandatory on conflict.

## 5. Decision workflow (deterministic logic)

```
INPUT: application + scorecard result + exposure check
1. compute group exposure (existing + proposed)
2. lookup approval authority by (exposure, rating, connected?)
3. route to lowest-eligible authority
4. require maker-checker at every save
5. if escalated: open committee item
6. on decision: record sanction terms, CPs, CSs
7. on decline: record decline code + reason
```

## 6. Mandatory pre-approval controls

A sanction **cannot** be recorded unless ALL of:

- KYC cleared (no open critical findings).
- AML/sanctions/PEP screening cleared or adjudicated.
- Spreading sign-off (maker + checker).
- Scorecard run on current spreading.
- Exposure check completed; any limit breach has an active waiver.
- Document checklist 100% (with stage-gates).
- Conflict-of-interest acknowledged by approver.
- If override of scorecard: justification + senior sign-off in place.

## 7. What is automated vs. human-controlled

| Task | Automation level |
|---|---|
| OCR extraction of financials | 🤖 Automated; analyst must verify |
| Balance-sheet balance check | 🤖 Automated, hard-fail |
| Financial ratio computation | 🤖 Automated, deterministic |
| Scorecard run | 🤖 Automated, deterministic |
| AI risk summary | 🤖 Advisory only, human reads |
| AI red-flag detection | 🤖 Advisory; surfaces to analyst |
| Exposure & limit check | 🤖 Automated, hard-fail at sanction |
| AML screening | 🤖 Automated triggers; **human adjudication** on hits |
| Rating override | 👤 Human only, with reason |
| Sanction decision | 👤 Human only, per matrix |
| Conditions clearance | 👤 Human (with system evidence) |
| Disbursement instruction | 👤 Human |
| Watchlist / EWS triage | 👤 Human review of system signal |

## 8. Backtesting & governance

- Quarterly backtesting of PD vs. realised default.
- Annual model-validation review by independent risk function.
- Population stability index (PSI) monitored monthly.
- Threshold drift triggers model recalibration.
- All model changes routed through Model Risk Committee.

## 9. Risk appetite framework (skeleton — to be ratified)

| Dimension | Limit type | Indicative threshold |
|---|---|---|
| Single counterparty (group) | Hard | 10% of capital base |
| Sector concentration | Soft | 25% of total exposure per sector |
| Country exposure (non-MY) | Hard | 15% |
| Related-party aggregate | Hard | per BNM Related Party Transactions framework |
| NPL ratio | Watch | 3% portfolio |
| Watchlist exposure | Watch | 8% portfolio |
| Stage-2 exposure | Watch | 12% portfolio |

Breaches: soft = report to Committee; hard = remediation plan with timeline.
