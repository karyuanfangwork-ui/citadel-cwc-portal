# CRM Reports Verification Report

Audit date: 2026-09-17. This was a read-only audit: no application code, migrations, or database records were changed.

## Executive Summary

| Section | Status | Severity | Root Cause | Fix Needed |
|---|---|---:|---|---|
| Lead Conversion | DEFECT FOUND | Medium | The reporting population is filtered by `crm_leads.created_at`, rather than the conversion event timestamp. | Yes |
| Sales Performance | DEFECT FOUND | High | One `createdAt` population drives created, won, and lost metrics; outcome events are not filtered by `wonAt`/`lostAt`. | Yes |
| Daily Operational | VERIFIED GOOD | None | Event-specific timestamps and the Kuala Lumpur day window are used consistently. | No |
| Forecast by Category | DEFECT FOUND | High | The category query includes closed-won and closed-lost opportunities. | Yes |
| Forecast Accuracy | BUSINESS LOGIC / DEFINITION ISSUE | High | Current-period COMMIT opportunities by creation date are compared with all revenue won in the period; no forecast snapshot/cutoff exists. | Clarification first |
| KYC Compliance | DEFECT FOUND | Low | KYC-record counts lack active/soft-delete guards on related contacts/accounts; the denominator has the same omission. | Yes |

### Scope observation

All six services use owner visibility (`resolveVisibleOwnerIds` and owner/account relations) but none adds a `tenantId` predicate, despite the relevant models having `tenantId`. The local database contains one tenant (`00000000-0000-0000-0000-000000000001`), so cross-tenant leakage cannot be demonstrated locally. Tenant isolation should be confirmed centrally before these reports are treated as tenant-safe.

## Lead Conversion

Status: **DEFECT FOUND**

### Current logic

Frontend `LeadConversionPanel` calls `GET /crm/reports/lead-conversion?from&to`; the route requires `crm:read`, and the controller resolves visible owners. `getLeadConversionReport` then runs three `crmLead.groupBy` queries by `source` plus one by `status`. Every query applies `deletedAt: null`, the owner scope, and `createdAt: { gte: from, lte: to }`. A conversion is identified by `status: 'CONVERTED'`, not by `wonAt` or an opportunity stage. The report uses no `tenantId` condition.

### Database verification

In the local seeded database there are 15 non-deleted leads, all created on 2026-09-11 UTC. Four are converted, each with a populated conversion timestamp and linked opportunity:

| Lead | `convertedAt` | Linked opportunity |
|---|---|---|
| Blockchain Supply Chain | 2026-09-15T02:44:59.760Z | `6ffbf401-…` |
| HR System Integration | 2026-09-17T03:03:22.742Z | `fe102cbe-…` |
| AI Chatbot Implementation | 2026-09-17T03:04:02.639Z | `602e2e8b-…` |
| Mobile App Development | 2026-09-17T03:04:37.580Z | `ce45d944-…` |

For a 2026-09-15–2026-09-17 report, the correct conversion-event population is four. The current `createdAt` predicate selects zero of those leads, because they were created on 2026-09-11. It consequently returns no conversions. The same wrong population is used by the source summary and the status pie, so they are internally consistent but not event-correct.

### Finding

Converted leads are not treated as Won, and `convertedToOppId` is correctly populated in the data. The date semantics are nevertheless incorrect for a conversion report: it measures the later status of leads *created* during the period, not leads *converted* in the period.

### Root cause

`backend/src/services/crm-reports.service.ts`, `getLeadConversionReport` (line 104) defines a shared `createdAt` date filter and reuses it for `status: 'CONVERTED'`.

### Minimal recommended fix

Keep a clearly labelled “leads created” denominator only if that cohort metric is intentional. For the requested conversion-event report, query converted records with `convertedAt` in the period (and `convertedAt: { not: null }`), and build the conversion summary/detail from that population. Define the denominator explicitly—conversion event count, or a creation cohort—rather than mixing the two.

### Files involved

- `frontend/pages/CrmReports.tsx` — `LeadConversionPanel` (line 338)
- `frontend/src/services/crm.service.ts` — `getLeadConversionReport` (line 704)
- `backend/src/routes/crm.routes.ts` — lead-conversion route (line 116)
- `backend/src/controllers/crm.controller.ts` — `getLeadConversionReport` (line 1505)
- `backend/src/services/crm-reports.service.ts` — `getLeadConversionReport` (line 104)
- `backend/prisma/schema.prisma` — `CrmLead.convertedAt`, `convertedToOppId`, `status`

## Sales Performance

Status: **DEFECT FOUND**

### Current logic

`SalesPerformancePanel` calls the sales-performance endpoint with the selected dates. The service selects non-deleted opportunities whose **`createdAt`** is within that range, optionally constrained to a pipeline and visible owners. It groups those rows by current owner. Within the selected creation cohort it marks an opportunity won/lost from the current stage flags (`stage.isWonStage` / `stage.isLostStage`), then sums `value` for the current stage outcome. `wonAt` and `lostAt` are selected but never used. Converted leads are naturally included once their linked opportunities exist, because the source is `crm_opportunities`.

### Database verification

The local database has 12 non-deleted opportunities in the selected September range, owned by `salesmanager@test.local`. Current stage yields 2 Closed Won opportunities (MYR 4,005,000) and 1 Closed Lost opportunity (MYR 100,000).

However, event fields show four `wonAt` events (MYR 4,345,000) and two `lostAt` events (MYR 300,000) in the same overall period. For example, `Supply Chain Optimization - Opportunity` has `wonAt = 2026-09-15T04:11:17.473Z` but was created 2026-09-11 and its current stage is Negotiation. A narrow 2026-09-15–2026-09-17 report therefore excludes it entirely, even though it has a won event in that window. The three opportunities created by lead conversion on 2026-09-17 are included as created opportunities, as expected.

### Finding

Created-opportunity counts and owner grouping are correct for a creation cohort. Won/lost counts, values, and win rate are not date-correct because they inherit the creation date population. The report also does not enforce that the event timestamp exists when using the stage flag.

### Root cause

`getSalesPerformanceReport` at `backend/src/services/crm-reports.service.ts:199` uses `createdAt` in `baseFilter` for all metrics, while only inspecting the current stage inside the loop.

### Minimal recommended fix

Retain a `createdAt` query for “Total Deals Created.” Calculate won and lost metrics from separate, owner-scoped, non-deleted event queries: `wonAt` in range plus the configured Closed Won stage, and `lostAt` in range plus Closed Lost stage. Merge owner rows by owner ID. This preserves creation counts while making outcomes event-based.

### Files involved

- `frontend/pages/CrmReports.tsx` — `SalesPerformancePanel` (line 445)
- `frontend/src/services/crm.service.ts` — `getSalesPerformanceReport` (line 708)
- `backend/src/routes/crm.routes.ts` — sales-performance route (line 117)
- `backend/src/controllers/crm.controller.ts` — `getSalesPerformanceReport` (line 1516)
- `backend/src/services/crm-reports.service.ts` — `getSalesPerformanceReport` (line 199)
- `backend/prisma/schema.prisma` — `CrmOpportunity.createdAt`, `wonAt`, `lostAt`, `value`, `ownerId`, `stageId`

## Daily Operational

Status: **VERIFIED GOOD**

### Current logic

The panel explicitly describes this as “Daily CRM-recorded operational activity.” It calls the endpoint with calendar days. The controller validates the owner/recorder scope and the service constructs an inclusive `Asia/Kuala_Lumpur` window (`00:00:00.000+08:00` through `23:59:59.999+08:00`). CRM activities are selected where either `createdAt` or `outcomeRecordedAt` is in the window, source is `CRM`, related entities are not soft-deleted, and visibility rules are satisfied.

Volume metrics are grouped by `createdAt`; outcome metrics are grouped by `outcomeRecordedAt` (falling back to `createdAt`). Lifecycle events are separate queries: conversions use `convertedAt`, lead losses use `lostAt` only when no opportunity was created, opportunity wins use `wonAt`, and opportunity losses use `lostAt`. All day keys are rendered in Kuala Lumpur time.

### Database verification

For 2026-09-11–2026-09-17, the database has 20 CRM-source activity rows: four each of CALL, EMAIL, MEETING, FOLLOW_UP, and TASK; 40 additional rows are `SYSTEM` notes and are correctly excluded. The report’s expected activity volumes are therefore 4 emails, 4 new calls, and 4 meetings; the four FOLLOW_UP rows have neither call category nor call outcome and correctly do not become follow-up-call metrics.

Lifecycle data verifies timestamp attribution: four conversions occur on 15/17 September, three unconverted lead losses on 15 September, four `wonAt` events, and two `lostAt` events. The service uses those event fields rather than `updatedAt` or record creation time. One opportunity has both timestamps; the report records each stored event on its respective event metric, which is faithful to the database. The underlying inconsistent lifecycle state is not a Daily Operational aggregation defect.

### Finding

The endpoint, service, filters, time-zone handling, and aggregation match the declared operational-report scope. No report defect was found.

### Files involved

- `frontend/pages/CrmReports.tsx` — `DailyOperationalPanel` (line 851)
- `frontend/src/services/crm.service.ts` — `getDailyOperationalReport` (line 746)
- `backend/src/routes/crm.routes.ts` — daily-operational route (line 120)
- `backend/src/controllers/crm.controller.ts` — `getDailyOperationalReport` (line 1548)
- `backend/src/services/crm-daily-report.service.ts` — `getDailyOperationalReport` (line 63)
- `backend/src/services/crm-report-window.ts` — Kuala Lumpur day-window helpers
- `backend/prisma/schema.prisma` — `CrmActivity`, `CrmLead`, `CrmOpportunity`

## Forecast by Category

Status: **DEFECT FOUND**

### Current logic

After a pipeline is selected, `ForecastCategoriesPanel` calls the category endpoint. `getPipelineForecastWithCategories` loads every non-deleted opportunity attached to every stage of that pipeline, within owner scope. It passes `value`, opportunity `probability`, and `forecastCategory` to `groupForecastByCategory`; weighted value is `round(value × opportunity.probability / 100)`. Unsupported/null-like category values fall back to PIPELINE. No date, stage-state, `wonAt`, or `lostAt` filter is applied to the category population. The service has no tenant predicate.

### Database verification

All 12 local opportunities are `forecastCategory = PIPELINE`, totaling MYR 5,775,000. That total includes two current Closed Won opportunities (MYR 4,005,000) and one current Closed Lost opportunity (MYR 100,000), plus other records with terminal event timestamps. Thus the displayed Pipeline category is materially inflated by closed deals. No duplicate opportunity appears in more than one stage/category—the stage relation is singular—so this is an inclusion defect, not duplicate grouping.

### Finding

Category labels and the category aggregation itself are deterministic, but the forecast scope is wrong: a forecast should not include closed opportunities. The category weighted calculation uses the opportunity probability, while stage-level weighted totals use the stage probability; these happen to match all current seed rows but can diverge if an opportunity probability is overridden.

### Root cause

`backend/src/services/crm-forecast.service.ts`, `getPipelineForecastWithCategories` (line 99), uses `scopedOpportunityWhere = { deletedAt: null, ...ownerScope(...) }` without excluding terminal stages/events.

### Minimal recommended fix

Add the same open-opportunity predicate used by the forecast’s overdue query: exclude won/lost stages and require `wonAt: null`, `lostAt: null`. Confirm whether the product’s canonical weighted probability is the opportunity override or the stage probability, then use that same source consistently in category and stage totals.

### Files involved

- `frontend/pages/CrmReports.tsx` — `ForecastCategoriesPanel` (line 1398)
- `frontend/src/services/crm.service.ts` — `getForecastCategoriesReport` (line 776)
- `backend/src/routes/crm.routes.ts` — forecast-categories route (line 124)
- `backend/src/controllers/crm.controller.ts` — `getForecastCategoriesReport` (line 1604)
- `backend/src/services/crm-forecast.service.ts` — `getPipelineForecastWithCategories`, `groupForecastByCategory` (lines 99, 32)
- `backend/prisma/schema.prisma` — `CrmOpportunity.forecastCategory`, `probability`, `wonAt`, `lostAt`; `CrmPipelineStage` flags

## Forecast Accuracy

Status: **BUSINESS LOGIC / DEFINITION ISSUE**

### Current logic

The page sends the selected inclusive dates to the forecast-accuracy endpoint. The service sums `value` for opportunities where `forecastCategory = 'COMMIT'` and **`createdAt`** is in the period. It separately sums `value` for every non-deleted opportunity with `wonAt` in the period; it does not require a Closed Won stage. Accuracy is `min(100, round(actualWonTotal / commitTotal × 100))` when both values are positive; otherwise zero. The service stores no forecast snapshot, forecast-as-of date, or category history.

### Database verification

There are no COMMIT-category opportunities locally, hence `commitTotal = 0`. There are four populated `wonAt` values totaling MYR 4,345,000 in the audited period. The endpoint therefore returns 0% despite real won revenue. This result follows the implemented formula, but it is not a meaningful accuracy result.

### Finding

The formula compares incompatible populations: a mutable category on opportunities *created* in the period against every opportunity *won* in the period, including opportunities created earlier and opportunities no longer in COMMIT. A later category change rewrites historical “forecast” without any audit/snapshot. The product has not defined whether a forecast is a beginning-of-period snapshot, a cutoff-date snapshot, a weighted pipeline, or a rep-entered commitment. That definition is required before a correct calculation can be implemented.

### Minimum clarification needed

Specify (1) forecast basis (COMMIT-only or weighted, and whether it is value or quantity), (2) the snapshot/cutoff moment, (3) the target close window, (4) whether actuals require both `wonAt` and Closed Won stage, and (5) treatment of late wins, lost commitments, and zero-forecast periods. A snapshot/history source is needed if the metric must be historical.

### Files involved

- `frontend/pages/CrmReports.tsx` — `ForecastAccuracyPanel` (line 1487)
- `frontend/src/services/crm.service.ts` — `getForecastAccuracyReport` (line 780)
- `backend/src/routes/crm.routes.ts` — forecast-accuracy route (line 125)
- `backend/src/controllers/crm.controller.ts` — `getForecastAccuracyReport` (line 1617)
- `backend/src/services/crm-forecast.service.ts` — `getForecastAccuracyReport`, `getForecastAccuracy` (lines 181, 63)
- `backend/prisma/schema.prisma` — no forecast-snapshot/history model exists; current `CrmOpportunity` fields are mutable

## KYC Compliance

Status: **DEFECT FOUND**

### Current logic

`KycCompliancePanel` calls an unfiltered report endpoint. The service treats a KYC entity as a `CrmKycRecord` attached to a `CrmContact`; the schema enforces one record per contact (`contactId @unique`), so historical duplicate records cannot occur under the current schema. It groups all in-scope KYC records by `status`, counts approved records expiring within 30 days, PEP flags, and non-deleted contacts. Owner visibility is via the contact’s account owner. It does not filter `CrmKycRecord` through `contact.deletedAt`, `contact.isActive`, `account.deletedAt`, or `account.isActive`; the contact denominator only checks `contact.deletedAt`.

### Database verification

The local database has 14 non-deleted contacts and six unique KYC records. All six are attached to active, non-deleted contacts/accounts and are APPROVED; one (Jeffrey Cheah) has `isPep = true`; all expire in September 2027. Therefore the current local response correctly derives Approved 6, Pending 0, Expired 0, PEP Flagged 1, Expiring Soon 0, and Compliance Rate `round(6 / 14 × 100) = 43%`.

### Finding

The current seed result is correct, status mapping is direct, and duplicates cannot occur. The query is nevertheless not robustly correct for the stated active-record scope: a KYC row whose contact/account becomes inactive or soft-deleted remains in the status, PEP, and expiring counts, while a soft-deleted contact can be absent from the denominator. This can overstate compliance or create a numerator/denominator mismatch.

### Root cause

`getKycComplianceReport` at `backend/src/services/crm-reports.service.ts:782` uses `contactAccountScope` solely for owner visibility. It lacks related-record active/deletion predicates in all KYC-record queries and lacks `isActive` predicates in the contact count.

### Minimal recommended fix

Define “in scope” as contacts and accounts that are both active and non-deleted, then reuse one relation filter for the KYC status, PEP, expiry, and contact-denominator queries. Preserve the one-record-per-contact model; no migration is needed.

### Files involved

- `frontend/pages/CrmReports.tsx` — `KycCompliancePanel` (line 1328)
- `frontend/src/services/crm.service.ts` — `getKycComplianceReport` (line 772)
- `backend/src/routes/crm.routes.ts` — KYC route (line 123)
- `backend/src/controllers/crm.controller.ts` — `getKycComplianceReport` (line 1596)
- `backend/src/services/crm-reports.service.ts` — `getKycComplianceReport` (line 782)
- `backend/prisma/schema.prisma` — `CrmKycRecord`, `CrmContact`, `CrmAccount`

## Recommended Fix Order

1. **Forecast Accuracy — definition issue (High).** Obtain the five forecast-definition decisions above before changing code. Likely files: `backend/src/services/crm-forecast.service.ts`, a new snapshot/history persistence design if historical accuracy is required, controller/UI labels. Test with a committed forecast created before the period, changed after cutoff, won/lost outcomes, and zero forecasts.

2. **Forecast by Category — closed deals included (High).** Apply the open-opportunity predicate to the source query and make probability sourcing consistent. Likely file: `backend/src/services/crm-forecast.service.ts`. Test Closed Won, Closed Lost, open, null/invalid category, owner scope, and stage/opportunity probability mismatch.

3. **Sales Performance — outcome dates incorrectly constrained by creation date (High).** Split created-deal and outcome-event populations while retaining owner grouping. Likely file: `backend/src/services/crm-reports.service.ts`. Test an older opportunity won/lost in range, a new open opportunity, converted leads that create opportunities, owner visibility, and both stage/event consistency requirements.

4. **Lead Conversion — conversion events constrained by creation date (Medium).** Change conversion-event queries to use `convertedAt` and label/define the denominator. Likely file: `backend/src/services/crm-reports.service.ts`; UI wording may also need adjustment in `frontend/pages/CrmReports.tsx`. Test a lead created before and converted within range, created in range and converted later, soft-deleted lead, owner scope, and linked opportunity.

5. **KYC Compliance — inactive/deleted related records can be counted (Low).** Centralize the active contact/account relation filter. Likely file: `backend/src/services/crm-reports.service.ts`. Test inactive and soft-deleted contacts/accounts with Approved/Pending/PEP/expiring records and verify the denominator uses the identical scope.
