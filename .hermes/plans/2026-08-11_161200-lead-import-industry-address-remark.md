# Lead Import: Industry, Address, and Remark — Implementation Plan

> Implementation completed locally; production deployment remains pending.

Date: 2026-08-11

## Goal

Extend the CRM Leads import flow so CSV/XLS/XLSX files can provide:

- Industry
- Address
- Remark

The fields must appear in the lead field reference, map automatically where possible, validate correctly, persist during import, appear in export output, and remain available in lead detail/API responses.

## Current assessment

### Current import flow

The flow is already end to end:

1. Frontend loads field definitions.
2. User downloads a CSV/XLSX template or uploads a file.
3. Backend parses the file and creates a `CrmImportJob` containing raw rows and suggested mapping.
4. Frontend allows column mapping.
5. Backend validates mapped values, currently sampling the first 100 rows.
6. Backend executes one `CrmLead.create()` per row and records row-level failures.
7. Import history/status are available through the existing API.

### Existing lead import fields

The service currently defines these LEAD fields in `backend/src/services/crm-import-export.service.ts`:

- `title`
- `contactName`
- `contactEmail`
- `contactPhone`
- `companyName`
- `source`
- `estimatedValue`
- `description`

The screenshot's Column Reference table is generated from this backend field-definition response; no hardcoded frontend field list is needed for the new rows.

### Current persistence gap

`backend/prisma/schema.prisma:2627` (`CrmLead`) currently has:

- contact/company fields
- `estimatedValue`
- `description`
- follow-up fields
- scoring/conversion fields

It does not have `industry`, `address`, or `remark`.

`backend/src/services/crm-import-export.service.ts:350-364` explicitly builds the lead create payload and currently persists only `description` among free-text lead details.

### Current UI/API context

- `frontend/src/services/crm.service.ts` defines `CrmLead` but currently has no `industry`, `address`, or `remark` properties.
- `frontend/pages/CrmLeadDetail.tsx` currently reads industry from `lead.account.industry`, not from the lead itself. Its edit form already contains an `industry` value but treats it as account-owned and sends it through the lead update path.
- `frontend/pages/CrmLeads.tsx` has create/edit lead forms and currently exposes description but not these three requested fields.
- `backend/src/controllers/crm.controller.ts` passes lead create/update request data through the CRM lead handlers, but the schema/service contract must be checked when the new fields are added.
- `backend/src/services/crm-import-export.service.ts:75-81` controls LEAD export aliases, so new fields will not be deliberately named in exports until added there.

## Recommended data ownership decision

### Recommendation: store all three as lead-owned nullable fields

Add these nullable fields to `CrmLead`:

- `industry String? @db.VarChar(255)`
- `address String? @db.Text`
- `remark String? @db.Text`

Reasoning:

- The current lead import creates a lead only; it does not resolve `Company Name` to an existing account or create an account.
- Writing imported lead industry/address into an account would require account matching/creation rules, ownership rules, duplicate handling, and a separate approval decision.
- A lead can represent an individual or an early prospect whose account is not yet known.
- `remark` is semantically different from the existing rich-text `description`/qualification notes and should not silently overwrite or alias it.
- Nullable fields preserve backward compatibility for existing leads and existing files.

### Alternative requiring explicit product approval

Treat `industry` and `address` as account fields and `remark` as lead description/follow-up note. This would require a separate account-resolution design:

- Does `Company Name` match an existing account by normalized name?
- If no match exists, should import create an account?
- Which owner/tenant owns a created account?
- What happens when multiple accounts match?
- Should existing account values be overwritten or left unchanged?
- How are individual leads without a company handled?

This alternative is out of scope for the first implementation unless the business explicitly chooses account-level ownership.

## Proposed schema contract

Use nullable columns so all new fields are optional in imports and old templates remain valid:

```prisma
industry String? @db.VarChar(255)
address  String? @db.Text
remark   String? @db.Text
```

Suggested placement: immediately after `companyName` and before `estimatedValue`/`description`, keeping lead identity/contact metadata together.

Database migration requirements:

- Add a forward-only migration for the three nullable columns on `crm_leads`.
- Do not backfill existing rows automatically unless a separately approved data-mapping rule exists.
- Verify actual PostgreSQL snake_case column names (`industry`, `address`, `remark`) in the migration SQL.
- Run Prisma generate/build after the schema change.
- Production deployment must follow the repository's schema/deployment procedure and backup gate; no production migration is implied by this plan.

## Implementation phases

### Phase 1: Lock the field semantics

Confirm the recommended ownership:

- `industry`: lead's prospective business sector, free text
- `address`: lead/prospect address, free text, potentially multiline
- `remark`: additional plain-text operational remark, separate from qualification `description`

Confirm whether labels should be exactly `Industry`, `Address`, and `Remark` in templates and UI. Do not use `Remarks` in one surface and `Remark` in another without an alias decision.

### Phase 2: Add the database and Prisma model fields

Files:

- Modify: `backend/prisma/schema.prisma` (`CrmLead`)
- Create: a new migration under `backend/prisma/migrations/` if this repository's production migration process is used for the release

Work:

- Add the three nullable fields with appropriate types.
- Keep `description` unchanged.
- Do not add indexes unless a later query/filter requirement justifies them; these are display/import fields, not search predicates yet.
- Confirm generated Prisma types expose all three fields.

### Phase 3: Extend the import field-definition and mapping contract

File:

- Modify: `backend/src/services/crm-import-export.service.ts`

Work:

1. Add to `ENTITY_FIELDS.LEAD`:
   - `{ key: 'industry', label: 'Industry', required: false, type: 'string' }`
   - `{ key: 'address', label: 'Address', required: false, type: 'string' }`
   - `{ key: 'remark', label: 'Remark', required: false, type: 'string' }`
2. Add explicit header aliases to `suggestColumnMapping()`:
   - `industrytype` → `industry` (already useful for account imports; verify collision behavior)
   - `industry` → direct normalized match
   - `address`, `addressline`, `street`, `registeredaddress` → `address`
   - `remark`, `remarks`, `note`, `notes` → `remark`
3. Ensure aliases are entity-safe. A `note` header for a lead must map to `remark`; do not accidentally map it to an unrelated entity field.
4. Preserve whitespace within address/remark values. Trim only for empty-value detection; do not collapse meaningful internal spaces or line breaks.
5. Add `industry`, `address`, and `remark` to `crmLead.create()` in `executeImport()`.
6. Convert empty spreadsheet cells to `null` for these nullable fields rather than the string `'undefined'` or an empty string where the application expects null.
7. Keep the existing row-level failure behavior, but include the field label in conversion/validation errors.
8. Consider changing validation from first-100-row sampling to all rows or explicitly document that validation is sampled. For this feature, at minimum add tests proving invalid values in rows beyond 100 are handled consistently with the existing contract before changing behavior.

### Export behavior

Add aliases to `EXPORT_COLUMN_ALIASES.LEAD`:

- `industry: 'Industry'`
- `address: 'Address'`
- `remark: 'Remark'`

The generic flattening/export path should then emit these columns for CSV and XLSX. Add them to deliberate export tests; do not rely only on object-key order.

### Import templates

No separate template implementation is required because `downloadImportTemplate()` derives headers from `getFieldDefinitions()`. Once the backend definitions are updated, both CSV and XLSX templates should include the three columns in the defined order.

### Field-definition API

The existing endpoint remains compatible:

- `GET /api/v1/crm/import/field-definitions?entity=LEAD`

Its response should include the three optional fields. No response envelope change is required.

### Phase 4: Update frontend types and lead surfaces

Files:

- Modify: `frontend/src/services/crm.service.ts`
- Modify: `frontend/pages/CrmLeads.tsx`
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Update: `frontend/src/__tests__/CrmImportExport.test.tsx`
- Add/update lead detail/list tests if the current frontend test setup covers those pages

Work:

1. Add nullable `industry`, `address`, and `remark` to the `CrmLead` interface.
2. Keep an explicit compatibility fallback for existing API payloads during rollout if required:
   - lead-owned `industry` first
   - account industry only as a legacy fallback until API responses are confirmed migrated
3. Update the lead detail display to show the lead-owned Industry and Address when present.
4. Add a separate Remark/Remarks section or field; do not render it as qualification notes unless product explicitly chooses that mapping.
5. Update edit/create forms only if the requested scope includes normal lead maintenance, not just import. Recommended: expose all three in the lead edit/detail flow so imported data can be corrected without another import.
6. Preserve current Markdown behavior for `description`; `remark` should be plain text unless a separate rich-text requirement is approved.
7. Ensure blank values can clear existing values on update without accidentally leaving stale data.
8. Keep the import page generic: it should render the fields returned by the backend definition API rather than add lead-specific hardcoding.

### Import page UX expectation

The existing UI should automatically show the new rows in:

- Column Reference — Leads
- Map Columns CRM Field dropdown
- CSV template
- Excel template

Add a small frontend regression assertion that the mocked LEAD field definitions containing the new fields render all three labels and that the mapping UI offers them after upload.

### Phase 5: Backend validation and integration tests

Files:

- Modify: `backend/src/__tests__/crm-import.integration.test.ts`
- Add a focused unit test for import field definitions/mapping if the current service test layout supports it

Test cases:

1. `GET field-definitions?entity=LEAD` returns optional `industry`, `address`, `remark` with type `string`.
2. Header suggestion maps:
   - `Industry` → `industry`
   - `Address` → `address`
   - `Registered Address` → `address`
   - `Remark`/`Remarks` → `remark`
3. Upload preview returns the three headers and suggested mapping.
4. Mapping validation accepts non-empty and empty optional values.
5. Full CSV import persists all three values on each created `CrmLead`.
6. XLSX import persists the same values, including multiline address/remark where supported by the parser.
7. Existing lead import files without the new columns still import successfully.
8. Column mapping can skip any of the three fields without failing.
9. Values containing commas, quotes, line breaks, Unicode, and spreadsheet-formula-like prefixes are stored/imported according to the existing sanitization contract.
10. A row with missing required `Title`/`Contact Name` still fails as before, while missing optional new fields do not.
11. Authorization remains unchanged: non-admin cannot upload/map/execute.
12. Import job status/error reporting remains correct when one row fails.
13. Export of a lead containing the new values includes `Industry`, `Address`, and `Remark` with correct values in CSV and XLSX.
14. Existing description remains unchanged when remark is supplied; this protects the distinction between the fields.

Avoid only asserting `importedRows > 0`; query the created lead by a unique test suffix and assert exact persisted values.

### Phase 6: Frontend verification

Files:

- Modify: `frontend/src/__tests__/CrmImportExport.test.tsx`
- Add/update tests for `CrmLeadDetail`/`CrmLeads` if existing test infrastructure supports them

Verify:

- new field labels render in the field-reference table
- new field definitions are offered in mapping controls
- generated template action remains available
- no duplicate labels or broken layout on the import page
- multiline address/remark preview is readable and not silently truncated in the mapping/preview flow
- lead detail renders lead-owned values and legacy account fallback correctly
- blank values do not render misleading placeholder text

Run frontend package typecheck/build in addition to tests; Vite build alone does not prove TypeScript contract alignment.

## Files likely to change

Backend:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<timestamp>_add_lead_import_fields/migration.sql`
- `backend/src/services/crm-import-export.service.ts`
- `backend/src/controllers/crm.controller.ts` only if request/update validation or response shaping requires changes after inspection
- `backend/src/__tests__/crm-import.integration.test.ts`
- potentially a focused import service test file

Frontend:

- `frontend/src/services/crm.service.ts`
- `frontend/pages/CrmLeads.tsx`
- `frontend/pages/CrmLeadDetail.tsx`
- `frontend/src/__tests__/CrmImportExport.test.tsx`
- potentially focused lead detail/list tests

No route change or new endpoint is expected.

## Data and compatibility rules

- All three new fields are optional.
- Existing import files remain valid.
- Existing leads remain valid with null values.
- No automatic account creation or account matching in this change.
- No automatic migration of existing `description` or `followUpNote` into `remark`.
- `remark` is not the same as `description` unless the business explicitly changes the decision.
- Preserve address line breaks and Unicode.
- Bound maximum field sizes through the database type and, if needed, explicit validation before insert. Decide and document whether overlong input is rejected per row or truncated; recommended behavior is reject the row with a clear error rather than silent truncation.
- Tenant/owner behavior remains the existing import behavior: imported leads are owned by the executing user unless a separate owner-mapping requirement is added.

## Rollout and migration plan

1. Implement schema, service, API type, frontend, and tests together.
2. Run Prisma generate and the migration against a disposable/staging database.
3. Verify existing lead counts and sample records are unchanged.
4. Run focused backend import integration tests.
5. Run frontend targeted tests, typecheck, and build.
6. Run the relevant full backend/frontend suites and record unrelated baseline failures separately.
7. Deploy schema before code paths that write the new fields, following the repository's production backup and migration procedure.
8. Verify the deployed field-definition API and download both templates.
9. Perform a production-like smoke import with a small approved file containing all three fields, then verify the stored lead and exported row.
10. Monitor import errors and application logs after release.

## Acceptance criteria

The feature is complete when:

- LEAD field definitions list Industry, Address, and Remark as optional strings.
- CSV and XLSX templates include all three columns.
- Automatic mapping handles the canonical labels and documented aliases.
- Validation accepts optional values and reports overlong/invalid input clearly.
- A successful import persists all three fields on `CrmLead`.
- Existing import files without them continue to work.
- Lead API/detail surfaces expose and display the values.
- CSV and XLSX exports include the three named columns.
- `description` remains independent from `remark`.
- Tests cover upload → mapping → validation → execute → persistence → export.
- Prisma build/typecheck and frontend build/typecheck pass.
- Migration has been tested on a fresh/staging database before production.

## Open product decision

Confirm before implementation:

Should Industry and Address be stored on the imported lead itself (recommended), or should they be resolved onto the related CRM account? The current import does not link/create accounts from `Company Name`, so account-level behavior would be a larger feature with matching, ownership, duplicate, and overwrite policies.
