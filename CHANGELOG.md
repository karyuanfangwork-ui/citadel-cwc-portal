# Change Log

## 2026-11-13

### HR hiring-manager decision visibility

- Keep the candidate-review action visible to the requester's HIRING_MANAGER account while the request remains pending, including recovery from an earlier partial attempt that marked the approval row approved. Visibility remains limited to the assigned requester with the HIRING_MANAGER role; no request data was changed.

### HR interview-feedback handoff

- Show interview feedback only to the requester's HIRING_MANAGER account at `INTERVIEW_SCHEDULED`, require both published decision outcomes before exposing the action, and tell HR agents to wait for manager feedback. Persist feedback/activity atomically with the final status transition, preserve authorization errors, and safely resume same-manager partial feedback. Created local HR Recruitment v6 as an unpublished draft with HIRING_MANAGER on both feedback outcomes; active v5 and HR-00013 remain unchanged.

### HR hiring-manager LOA approval

- Limit LOA decisions to the request's HIRING_MANAGER requester, expose the action only when both published outcomes are available, and show HR agents that they must wait for the manager before issuing the LOA. Commit the LOA approval fields and activity with the status transition and preserve authorization errors. Created local HR Recruitment v7 with HIRING_MANAGER on the LOA decision edges; v7 is now active. The guard reads roles from the HTTP adapter's `actor.roles`, preventing a false denial; HR-00013 data remains unchanged.

## 2026-11-12

### HR reference-check action banner restore

- Restored the missing agent action banner for `INTERVIEW_FEEDBACK_PENDING` from the existing admin-config backup so HR can start reference screening; the banner-only restore is restricted to local `help_center` and does not restore unrelated admin/user data. Full admin-config restores now also restore backed-up banner configurations.

### LOA issuance transition guard

- Load LOA approval/signature preconditions from the LOA record instead of relying on an unselected relation in the central request snapshot for issuance and final completion. Move `issuedDate` and `acceptedDate` updates into their status transition transactions and preserve expected `AppError` status codes so failed transitions do not leave misleading LOA metadata or return a generic 500.

### HR candidate document upload confirmation

- Allow up to two minutes for the three-file upload endpoint, show progress and a success toast, and verify candidate document records after an ambiguous network failure before asking HR to retry. This prevents a committed upload from appearing failed or encouraging duplicate submissions.

### HR hiring-manager candidate decision

- Make manager approval, candidate selection, assignment, and activity writes atomic; allow the same manager to resume a prior partial attempt while the request remains pending, and preserve expected transition error codes. Created an unpublished local HR Recruitment v5 draft permitting the HIRING_MANAGER decision paths; active v4 and request records remain unchanged pending review/publication.

## 2026-11-11

### Workflow designer validation layout

- Collapsed advisory warning details by default while keeping warning/blocker counts visible; blockers remain expanded and warning details are available on demand in a bounded scroll area so numerous legacy warnings no longer crowd out the graph canvas.

### HR recruitment requester-selected executive approval

- New Hiring submissions require a named, active, same-tenant CEO or Group Deputy CEO choice with an explicit matching role; the choice is persisted separately from editable form fields and does not assign the executive or create an approval until HR routes. Other request types keep their existing creation behavior.
- Added an authenticated, tenant-scoped candidate lookup that exposes only names, IDs, and eligible roles. The additive nullable schema/migration preserves existing requests without backfill. After a verified local backup, applied this migration to the restored local `help_center` to restore request-list availability; no request data was changed and production remains untouched.
- Requesters can choose an executive on older unrouted hiring requests with versioned, tenant-safe updates; the request detail displays the saved name, and HR agents route only to that person. CEO or Group Deputy CEO decisions are exclusive and atomic with approval, assignment, audit and outbox intent; either approved branch can proceed to job posting without a second executive. Generic transition paths cannot bypass the saved choice.
- The create/review/draft and detail/action UI now show the requester choice and hide missing or graph-disallowed routes. Finance, ESM and IT approval paths remain scoped separately. The HR graph changes are authored as a local draft; no restored ticket, production workflow version or production database was changed.

## 2026-11-02

### Local development S3 storage

- Replaced LocalStack with pinned open-source SeaweedFS 4.51, loopback-only S3 on port 8333, automatic `helpdesk-uploads` initialization, local-only credentials, and a dedicated persistent volume. Updated local environment/setup instructions; production Compose, Spaces credentials, CRM business logic, existing data volumes, and pending feature changes are preserved. No database migrations are applied.
- Verified healthy startup, authenticated bucket/object round trip, CRM account upload/list/download byte equality/soft deletion, and existing lead document upload/list/download/delete using isolated local fixtures; cleaned only the dedicated test data. Added repeatable local verification scripts; browser/HTTP authentication was not exercised by these service checks.

### CRM client account documents

- Added private, account-scoped PDF upload, paginated listing, authenticated download, and soft deletion for CRM client accounts, including audit events and owner/team/tenant authorization; existing Client Notes, Lead Documents, lead scanning, profiles, activities, and workflows remain unchanged.
- Added the additive `crm_account_documents` migration and reused the existing S3-compatible storage configuration with opaque `crm/accounts/{accountId}/{UUID}.pdf` keys; files are limited to validated PDFs of 10 MB each with no per-account document-count limit.
- Added the Client Documents interface and corrected the Account "Upload Document" action to open PDF selection instead of Add Note, while preserving Add Note as a separate action and hiding upload/delete controls without `crm:write`.
- Added focused backend and frontend regression coverage. Malware scanning and quarantine for account documents are explicitly not included in this approved scope.
- Documented endpoints, migration, storage reuse, permissions, verification results, proxy request-size prerequisites, and rollback considerations in `CRM_ACCOUNT_DOCUMENTS.md`.

## 2026-10-05

### Finance Purchase Requisition catalog visibility

- Published the seeded Finance Purchase Requisition catalog item so newly initialized local environments expose it in the New Request flow; other request types, workflows, permissions, and catalog configuration remain unchanged.
- Added the required CEO approver selector to the seeded Finance Purchase Requisition form after the quotation upload field, preserving all other catalog fields and the separate confidentiality control.

### Local attachment storage

- Replaced the unpinned local MinIO development service with pinned LocalStack S3, automatic `helpdesk-uploads` bucket initialization, and matching local path-style configuration; production S3/Spaces configuration and unrelated local services remain unchanged.

## 2026-09-29

### CRM backend build typing

- Corrected CRM lifecycle transaction and update-payload typing plus imported-stage probability typing for production Docker build validation; runtime lifecycle, import behavior, Prisma schema, migrations, and dependencies remain unchanged.

## 2026-09-28

### CRM regression validation — fixture cleanup

- Hardened the Lead Lifecycle integration fixture cleanup to remove role assignments scoped to its own test-role prefix before deleting those roles, preventing stale interrupted-test records from blocking the focused lifecycle regression suite. No product behavior or database schema changed.

### CRM Opportunities — lifecycle enforcement

- Centralized Opportunity lifecycle transitions so new Opportunities and Lead conversions start at the first active pipeline stage, active deals advance exactly one stage at a time, Closed Lost requires a reason and supports a reasoned reopen, and Closed Won is terminal. Generic edits and workflow field actions cannot bypass stage, pipeline, probability, or terminal metadata safeguards; detail-page controls now expose only the permitted lifecycle actions.
- Preserved stage probability synchronization, stage gates, history, activity, audit, Forecast Category editing, pipeline administration, reports, and existing Opportunity value behavior. No Prisma schema migration or historical data correction was added.

### CRM integration tests — local fixture isolation

- Hardened Forecast Category, Lead Lifecycle, Stage Gate, and Lead Conversion integration fixtures with scoped pre- and post-cleanup; Forecast Category and Lead Lifecycle records now carry unmistakable `[TEST]` markers, while cleanup remains limited to each suite's generated identifiers and preserves application data.
- Removed the two confirmed Forecast Category test pipelines and their exact associated local test graph; no pipeline-management product behavior, CRM business rules, or production configuration was changed.

### CRM Leads — lifecycle enforcement

- Centralized Lead Lost, Unqualified, and Reopen actions behind validated endpoints; protected terminal status changes from generic updates, workflow field writes, and duplicate merges while preserving normal Lead edits, optional Estimated Value behavior, import-to-NEW behavior, and existing Opportunity lifecycle scope.
- Added ordered active Lead progression through dedicated detail-page and API actions: forward skipping is allowed while backward and same-status movement remain blocked.

### CRM Opportunities — stage-derived probability

- Enforced the selected pipeline stage as the Probability source of truth for Opportunity create, stage/pipeline update, stage moves, Lead conversion, imports, and supported demo seeds; direct client and generic-workflow writes are rejected. Pipeline administrators can update a stage probability through validated fields and atomically synchronize only Opportunities in that stage. Manual Probability inputs were removed while preserving the schema, migrations, lifecycle rules, reporting, import structure, and existing historical data.

### CRM listings — view-only existing records

- Removed Lead and Opportunity listing mutation controls while preserving creation, detail navigation, filtering, sorting, pagination, Lead import/export, and selected-Lead export. Opportunity Forecast Category editing remains available from the detail-page edit form; lifecycle, stage, probability, reporting, import, backend, and database behavior are unchanged.

### CRM Opportunities — Forecast Category persistence

- Allowed the four supported Forecast Category values through Opportunity create and update validation, aligned the Omit form value with reporting, and preserved existing reporting, import, stage, probability, lifecycle, and database behavior.

### CRM Leads — optional Estimated Value handling

- Preserved blank Estimated Value as absent or null, retained explicit zero, and allowed users to clear an existing Lead estimate without changing Opportunity values, conversion fallback, database schema, or workflow-field behavior.

## 2026-09-23

### CRM Activity Reminders — meaningful notification content

- Replaced raw CRM reminder event-key fallbacks with activity type, subject, due time, and linked Opportunity, Lead, Account, or Contact context; scheduled and manual reminders now use one payload contract.
- Activated and updated the CRM reminder template, with a targeted rectify command for existing configurations; notification navigation, scheduling rules, reminder de-duplication, schema, and unrelated notification types are preserved.

### CRM Leads — import navigation

- Fixed Import Leads to target the Lead import workflow directly for users with CRM import permission, and restricted Leads import/export controls to their respective existing permissions. Authorized styling and export behavior remain unchanged.

## 2026-09-22

### CRM Meetings — scheduled activity creation

- Standardized meeting scheduling across Lead, Contact, and Opportunity activity forms: a required Scheduled At value is now sent with new meeting activities so they can be included consistently in Dashboard “Meetings Today”; non-meeting activity behavior and existing Dashboard, report, timezone, lifecycle, and schema logic are preserved.

## 2026-09-21

### CRM Opportunities — scalable Stage filter

- Changed the Opportunities Stage filter to show one normalized logical stage name across All Pipelines, while retaining ID-based, pipeline-specific stage selection when a Pipeline is chosen.
- Added server-side `stageName` filtering that resolves matching stages from the authenticated tenant's active pipelines before opportunity pagination; search, pipeline, overdue, authorization, tenant scope, soft-delete, and result-count behavior are preserved.
- Pipeline changes now preserve a selected logical stage only when it exists in the newly selected scope, preventing stale stage IDs.

### CRM Clients — alphabetical ordering

- Changed the unified CRM Clients list to order the complete scoped Accounts and Contacts result set by displayed client name, case-insensitively, before applying pagination.
- Added a deterministic `id` tie-breaker for duplicate client names; existing search, filters, owner visibility, soft-delete exclusion, authorization, and pagination behavior remain unchanged.

### CRM Clients — account/contact grouping

- Changed the unified Clients endpoint and page from mixed Account and Contact rows to one alphabetically paginated Account client card/row with its active canonical Contacts embedded.
- Contact-name and email searches now return the owning Account card; inactive or soft-deleted Contacts and secondary `CrmContactAccountRole` affiliations are excluded.
- Updated All, Mine, Active, Overdue Follow-ups, and Open Opportunities scopes to return Account cards, retaining authorization, owner visibility, tenant scoping, and the existing open-opportunity definition.
- Updated Client totals and pagination to count Accounts rather than the former combined Account-plus-Contact result set.

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
