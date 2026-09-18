# Change Log

## 2026-09-17

### CRM Reports — Sales Performance outcome dates

- Split Sales Performance into separate opportunity populations: deals created by `createdAt`, Closed Won outcomes by `wonAt`, and Closed Lost outcomes by `lostAt`.
- Won and lost outcomes now require both the corresponding in-period lifecycle event and the currently configured Closed Won/Closed Lost stage; terminal-stage flags alone do not count an outcome.
- Preserved the existing response shape, owner visibility, pipeline filter, soft-delete exclusion, and owner-ID grouping; outcome-only owner rows are merged into the same report result.
- Kept the existing overall win-rate formula (`won / (won + lost)`) and the existing per-owner formula (`won / created`) for compatibility.
- Added regression coverage for cross-period outcomes, created/open deals, converted-lead opportunities, owner grouping, scoped filters, and inconsistent lifecycle records.

### CRM Reports — Lead Conversion event dates

- Changed Lead Conversion reporting to count converted leads by their `convertedAt` event timestamp, rather than lead creation date.
- A lead created before the reporting period now appears when it is converted within that period; leads converted after the period do not.
- Defined conversion-rate totals as completed lead outcomes in the period (`CONVERTED` plus `LOST`), avoiding a mixed event/cohort denominator.
- Kept owner visibility and soft-delete exclusions intact, and retained the distinction between a lead conversion and an opportunity win.
- Updated Lead Conversion report and CSV wording to identify completed outcomes as the rate denominator.
- Added focused regression tests for conversion-event date filtering, soft deletion, owner scope, and non-win conversion semantics.

### CRM Reports — Pipeline Forecast stage drill-down

- Made non-zero Pipeline Forecast stage deal counts clickable and added an in-place opportunities modal with the selected stage in its title.
- Reused the existing paginated, authorization-scoped Opportunities API with the Pipeline Forecast's pipeline and stage filters.
- Added opportunity name, merchant/company, primary contact, owner, value, and expected-close-date columns; names use the existing Opportunity details route.
- Added loading, empty, and error states plus Previous/Next pagination, backdrop/X/Close controls, and Escape-to-close support without refreshing the Reports page.
- Made the dialog surface opaque and high contrast, added keyboard focus management and visible focus indicators, and prevent invalid opportunity values from rendering as currency `NaN`.
- Aligned the dialog with the established Pipeline Forecast language: navy translucent backdrop, rounded white surface, report-blue actions and links, shared borders, typography, spacing, and interaction states.
- Ordered stage drill-down rows alphabetically by Merchant / Company across all pagination pages.

## 2026-09-15

### CRM Reports — Win/Loss board metrics

- Made Won Opportunity Value, Lost Opportunity Value, Lost Lead Estimated Value, and Opportunity Win Rate the primary summary metrics.
- Added lost-lead estimated-value data to the report response, the Lost Leads table, and its CSV export.
- Changed the outcome donut to compare only Closed Won and Closed Lost opportunities, matching the opportunity win-rate denominator.
- Removed donut labels and hover tooltip overlays that obscured the chart; visible labels now render below the chart.
- Added Closed Won and Closed Lost percentages to the visible donut legend.
- Moved the Win/Loss count and percentage into each donut segment; the legend now identifies colours only.
- Reworked the outcome labels to match the requested leader-line layout: `Closed Won <percentage>` and `Closed Lost <percentage>` outside the donut, with chart margins to keep labels visible.
- Restored Opportunity Win Rate and its donut denominator to Closed Won and Closed Lost opportunities only; lost leads remain reported separately.
- Corrected Win/Loss KPI-card contrast in dark mode by retaining the original light-mode dark text colours on the existing light card surface.
- Applied the same light reporting text and surface tokens across every CRM Reports panel; report-tab hover retains its background with an explicit dark-navy border and text, and date presets/inputs retain readable light-mode colours in dark mode.
- Replaced the Lost Lead Estimated Value summary metric with a simple Lost Leads count; estimated value remains available in the table and export.
- Renamed the outcome donut to Opportunity Win Rate and restored its hover tooltip to show the hovered Won or Lost count.
- Repaired a report-page runtime error caused by placing the Win/Loss percentage calculation in the Lead Conversion panel; added compatibility guards for an older Win/Loss API response.

## 2026-09-14

### CRM Reports — Win/Loss

- Changed wins to include only opportunities currently in a pipeline stage configured as Closed Won.
- Changed losses to combine opportunities currently in a pipeline stage configured as Closed Lost with leads whose status is Lost.
- Removed converted leads from the Win/Loss report; conversion is not a win.
- Added Closed Won and Closed Lost opportunity record tables to the report.
- Changed lost-lead reporting to use the immutable `lostAt` outcome timestamp rather than `updatedAt`.
- Added focused regression coverage for the corrected outcome rules.
