# Sprint 5 — Financial Spreading & Reporting: Detailed Implementation Plan

**Parent doc:** `docs/2026-06-09-credit-audit-implementation-plan.md` (S5, Week 9-10)
**Created:** 9 June 2026
**Status:** COMPLETE ✓

---

## Codebase Assessment Summary

| Item | Status | Key Finding |
|------|--------|-------------|
| FinancialsTab SpreadViewTable | **EXISTS** — complete | Multi-year columns, YoY %, ratio comparison with threshold badges already built |
| Credit reports service | **PARTIAL** | `dashboard.service.ts` has pipeline/exposure, no turnaround |
| Credit reports routes | **PARTIAL** | `/pipeline` + `/exposure` with CSV, no turnaround endpoint |
| CreditReports.tsx | **PARTIAL** | 2 tabs (pipeline, exposure) + CSV export, no turnaround tab |
| Generic CSV export method | **MISSING** | CSV is hardcoded inline per endpoint |
| Excel/XLSX export | **MISSING** | Not implemented anywhere |
| FinancialSpreading.tsx standalone page | **MISSING** | Not needed — FinancialsTab covers it |
| Approval turnaround report | **MISSING** — all layers | No backend method, route, or UI tab |

**Conclusion:** S5.1 (Multi-Period View) is already implemented — verify only. S5.2 (Turnaround Report) and S5.3 (CSV/Excel Export) need full build-out.

---

## 5.1 Financial Spreading Multi-Period View — VERIFY ONLY

**Priority:** HIGH (audit Finding #10)
**Effort:** 0.5 day (verification + polish)

### What Already Exists

`FinancialsTab.tsx` (1,121 lines) contains a fully functional `SpreadViewTable`:

- **Multi-year columns:** Dynamic `FY{year}` columns based on each `FinancialStatement.fiscalYearEnd`
- **YoY % change:** `yoyChange()` computes percentage delta between last two fiscal years with ▲/▼ arrows + green/red color coding
- **Ratio comparison:** Nested ratio table rows show ratios across years with threshold badges (passMin/passMax/warnMin/warnMax → ✅/⚠/❌)
- **Toggle:** "Spread View" button switches between list and spread view
- **Retail routing:** INDIVIDUAL/SOLE_PROPRIETOR borrowers route to RetailIncomeTab instead

### Verification Checklist

| # | Check | Expected | Pass? |
|---|-------|----------|-------|
| 1 | Navigate to a CORPORATE borrower's FinancialsTab | Shows "Spread View" toggle button | ⬜ |
| 2 | Click "Spread View" | Table switches to multi-column layout with FY20xx headers | ⬜ |
| 3 | Create 2+ financial statements for same borrower (different fiscalYearEnd) | Both appear as separate year columns side-by-side | ⬜ |
| 4 | YoY % change column appears | ▲/▼ with percentage, correct sign | ⬜ |
| 5 | Ratio sub-table shows per-year values with threshold badges | Green/yellow/red badges on ratios | ⬜ |
| 6 | INDIVIDUAL borrower → FinancialsTab | Routes to RetailIncomeTab, no crash | ⬜ |

### Minor Polish (if gaps found)

1. **Add period label to spread headers** — currently shows `FY{year}`. If quarterly statements exist, show `FY{year} Q{n}`.
2. **Empty state** — If no financial statements exist, show a helpful empty state message instead of an empty table.
3. **Print-friendly layout** — Add `@media print` CSS to hide the toggle button and ensure columns don't overflow.

### Files to Touch (only if gaps found)
- `frontend/pages/credit/tabs/FinancialsTab.tsx` — Polish

---

## 5.2 Approval Turnaround Report — FULL BUILD

**Priority:** HIGH (audit Finding #14)
**Effort:** 2 days (1 BE + 1 FE)

### Business Logic

For each application that reached a terminal or post-approval state (APPROVED, REJECTED, ACTIVE, CLOSED, DISBURSED):
- `turnaroundDays` = difference (in calendar days) between `submittedAt` and `firstApprovalAt`
- `submittedAt` = earliest `CreditDecision.createdAt` where `decision = PENDING` OR the `CreditApplication.createdAt` (if no explicit submission timestamp)
- `firstApprovalAt` = earliest `CreditDecision.createdAt` where `decision = APPROVE`

**Group by dimensions:** product type, month (of submission), assigned RM
**Aggregates:** avg days, median days, P90 (90th percentile), count

### Database Query Design

```sql
-- Core turnaround calculation
SELECT
  ca.id AS application_id,
  ca.application_no,
  bp.name AS borrower_name,
  ca.product_type,
  ca.assigned_rm_id,
  u.name AS rm_name,
  ca.submitted_at,
  first_approve.created_at AS first_approval_at,
  EXTRACT(EPOCH FROM (first_approve.created_at - ca.submitted_at)) / 86400 AS turnaround_days
FROM credit_applications ca
JOIN borrower_profiles bp ON ca.borrower_profile_id = bp.id
LEFT JOIN users u ON ca.assigned_rm_id = u.id
LEFT JOIN LATERAL (
  SELECT MIN(cd.created_at) AS created_at
  FROM credit_decisions cd
  WHERE cd.application_id = ca.id
    AND cd.decision = 'APPROVE'
) first_approve ON TRUE
WHERE ca.state IN ('APPROVED', 'REJECTED', 'ACTIVE', 'CLOSED', 'DISBURSED')
  AND ca.submitted_at IS NOT NULL
  AND first_approve.created_at IS NOT NULL
```

### Backend Implementation

#### 5.2.1 Service Method

**File:** `backend/src/credit/services/dashboard.service.ts` (add method here — it's the credit reports hub)

```typescript
interface TurnaroundFilters {
  dateFrom?: string;       // ISO date — filter by submitted_at >=
  dateTo?: string;          // ISO date — filter by submitted_at <=
  productType?: string;    // Application product type
  rmId?: string;           // Assigned RM user ID
  branchId?: string;       // Branch filter
  groupBy?: 'product' | 'month' | 'rm';  // Grouping dimension (default: 'month')
}

interface TurnaroundResult {
  applications: Array<{
    applicationId: string;
    applicationNo: string;
    borrowerName: string;
    productType: string;
    rmName: string;
    submittedAt: Date;
    firstApprovalAt: Date;
    turnaroundDays: number;
  }>;
  summary: {
    groupBy: string;
    groups: Array<{
      key: string;          // e.g. "2026-05" or "TERM_LOAN" or "John Smith"
      label: string;
      count: number;
      avgDays: number;
      medianDays: number;
      p90Days: number;
    }>;
    overall: {
      count: number;
      avgDays: number;
      medianDays: number;
      p90Days: number;
    };
  };
}

async getApprovalTurnaround(filters: TurnaroundFilters): Promise<TurnaroundResult>
```

**Percentile calculation:** Use PostgreSQL `PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY turnaround_days)` for P90. Prisma doesn't support `PERCENTILE_CONT` natively — use `$queryRaw` for the aggregation query.

**Median:** Same approach — `PERCENTILE_CONT(0.5)`.

#### 5.2.2 Route

**File:** `backend/src/credit/routes/reports.routes.ts` (add endpoint)

```typescript
// Add after existing /exposure route
router.get(
  '/approval-turnaround',
  requirePermission('credit:read'),
  creditExportLimiter,
  validate(turnaroundFilterSchema),
  reportsController.getApprovalTurnaround
);
```

**Zod schema** (`turnaroundFilterSchema`):
```typescript
const turnaroundFilterSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  productType: z.string().optional(),
  rmId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  groupBy: z.enum(['product', 'month', 'rm']).default('month'),
  format: z.enum(['json', 'csv']).default('json'),
});
```

**CSV format handling** — when `format=csv`, return CSV with `Content-Disposition: attachment` header (same pattern as existing pipeline/exposure CSV export).

#### 5.2.3 Controller

**File:** `backend/src/credit/controllers/reports.controller.ts` (or dashboard.controller.ts — follow existing pattern)

Add `getApprovalTurnaround` handler that:
1. Extracts query params
2. Calls `dashboardService.getApprovalTurnaround(filters)`
3. If `format=csv`, convert to CSV and return as attachment
4. If `format=json`, return JSON

### Frontend Implementation

#### 5.2.4 Service Method

**File:** `frontend/src/services/credit.service.ts`

```typescript
// Add to creditApi or reportsApi object
getApprovalTurnaround: async (params: {
  dateFrom?: string;
  dateTo?: string;
  productType?: string;
  rmId?: string;
  branchId?: string;
  groupBy?: 'product' | 'month' | 'rm';
}): Promise<TurnaroundResult> =>
  creditApi.get('/reports/approval-turnaround', { params }),
```

#### 5.2.5 UI — New Tab in CreditReports.tsx

**File:** `frontend/pages/credit/CreditReports.tsx`

Add `'turnaround'` as a third tab alongside `'pipeline'` and `'exposure'`.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ [Pipeline] [Exposure] [Approval Turnaround]    [Filters] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │Avg Days │ │Median   │ │P90 Days │ │Total App│       │
│  │  12.3   │ │  10.0   │ │  21.4   │ │  47     │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                          │
│  Group By: [Month ▼] [Product ▼] [RM ▼]                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Period    │ Count │ Avg  │ Median │ P90  │ Trend │   │
│  │ 2026-01   │  12   │ 8.2  │  7.0   │ 14.1 │  ─    │   │
│  │ 2026-02   │  15   │ 9.1  │  8.0   │ 16.3 │  ↑    │   │
│  │ 2026-03   │  20   │ 7.4  │  6.5   │ 12.8 │  ↓    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Detail Table (expandable):
│  App No | Borrower | Product | RM | Submitted | Approved | Days
│                                                          │
│  [Export CSV]                                            │
└──────────────────────────────────────────────────────────┘
```

**Components:**
1. **Summary cards** — Avg/Median/P90/Count (4 cards, same style as existing Pipeline summary cards)
2. **Group selector** — Dropdown to switch groupBy dimension
3. **Aggregation table** — Rows grouped by selected dimension, columns for count/avg/median/P90/trend arrow
4. **Detail table** — Expandable/collapsible table showing individual applications
5. **Date range filter** — dateFrom/dateTo pickers (reuse existing filter pattern from Pipeline tab)
6. **Export button** — Reuse existing `handleExportCsv()` pattern

### Pitfalls

1. **REJECTED applications have no firstApprovalAt** — They have the submission timestamp but no approval. Only include apps that reached APPROVED or post-APPROVED states in turnaround calculation. Rejected apps go into a separate "rejected-without-turnaround" count.
2. **`submittedAt` might be null** — Some legacy apps may not have explicit submission timestamps. Fallback: use first state transition from DRAFT → any post-DRAFT state via `AuditChain` events.
3. **P90 raw query** — Prisma cannot express `PERCENTILE_CONT`. Use `$queryRaw` with tagged template literals. Cast `Decimal` fields to `float8` in SQL.
4. **Large datasets** — If >10k applications, the detail table should paginate. The aggregation query is always fast (GROUP BY).
5. **CSV column headers** — Use human-readable headers ("Application No" not "application_no").

### Verification

1. Backend: `GET /api/v1/credit/reports/approval-turnaround` returns JSON with `applications[]` and `summary{}`
2. Backend: `GET /api/v1/credit/reports/approval-turnaround?format=csv` returns downloadable CSV
3. Frontend: CreditReports shows "Approval Turnaround" tab
4. Frontend: Summary cards show correct avg/median/p90/count
5. Frontend: Switching groupBy dropdown re-fetches and re-renders aggregation table
6. Frontend: "Export CSV" downloads correct file
7. Empty state: No completed applications → show "No turnaround data available" message

---

## 5.3 CSV/Excel Data Export — ENHANCE EXISTING

**Priority:** MEDIUM
**Effort:** 1.5 days (1 BE + 0.5 FE)

### Current State

- Pipeline and Exposure reports already support `?format=csv`
- CSV generation is **hardcoded inline** per route handler — not reusable
- No Excel/XLSX support anywhere
- `CreditExportEvent` model exists for audit logging
- `creditExportLimiter` rate limiter exists
- Frontend `handleExportCsv()` creates a Blob from the response and triggers download

### Implementation

#### 5.3.1 Reusable CSV Export Utility

**File:** `backend/src/credit/utils/csvExport.ts` (NEW)

```typescript
interface CsvExportOptions {
  headers: string[];         // Human-readable column headers
  rows: any[][];             // Row data arrays
  filename: string;          // Download filename (without extension)
}

function generateCsv(options: CsvExportOptions): string {
  // Escape fields (quotes, commas, newlines)
  // Return CSV string
}

function sendCsvResponse(res: Response, csv: string, filename: string): void {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(csv);
}
```

**Reuse pattern:** Replace inline CSV generation in pipeline and exposure route handlers with `generateCsv()` + `sendCsvResponse()`.

#### 5.3.2 Reusable XLSX Export Utility

**File:** `backend/src/credit/utils/xlsxExport.ts` (NEW)

```typescript
interface XlsxExportOptions {
  headers: string[];
  rows: any[][];
  filename: string;
  sheetName?: string;        // Default: 'Report'
}

async function generateXlsx(options: XlsxExportOptions): Promise<Buffer> {
  // Use exceljs or xlsx library
  // Return buffer
}

function sendXlsxResponse(res: Response, buffer: Buffer, filename: string): void {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.send(buffer);
}
```

**Package choice:** `exceljs` (supports styling, streaming, multi-sheet) or `xlsx` (lighter, no streaming). Recommend `exceljs` for future multi-sheet reports.

#### 5.3.3 Unified Export Route Enhancement

**File:** `backend/src/credit/routes/reports.routes.ts`

Add `format` query param to ALL credit report endpoints:

```typescript
// Existing:
// GET /pipeline?format=csv
// GET /exposure?format=csv
// NEW (S5.2):
// GET /approval-turnaround?format=csv

// Add format=xlsx support to all three:
// GET /pipeline?format=xlsx
// GET /exposure?format=xlsx
// GET /approval-turnaround?format=xlsx
```

**Updated Zod schema** — change format validation:
```typescript
format: z.enum(['json', 'csv', 'xlsx']).default('json'),
```

**Route handler pattern:**
```typescript
if (format === 'csv') {
  const csv = generateCsv({ headers, rows, filename });
  await exportAuditService.logExport({ userId: req.user!.id, reportType, filters, rowCount, format: 'csv' });
  return sendCsvResponse(res, csv, filename);
}

if (format === 'xlsx') {
  const buffer = await generateXlsx({ headers, rows, filename, sheetName: reportType });
  await exportAuditService.logExport({ userId: req.user!.id, reportType, filters, rowCount, format: 'xlsx' });
  return sendXlsxResponse(res, buffer, filename);
}

// Default: json
return res.json(result);
```

#### 5.3.4 Frontend Export Buttons

**File:** `frontend/pages/credit/CreditReports.tsx`

Add format dropdown to the Export button:

```tsx
// Replace single "Export CSV" button with dropdown
<div className="relative">
  <button onClick={() => setShowExportMenu(!showExportMenu)}>
    <Download /> Export
  </button>
  {showExportMenu && (
    <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
      <button onClick={() => handleExport('csv')}>Export CSV</button>
      <button onClick={() => handleExport('xlsx')}>Export Excel</button>
    </div>
  )}
</div>
```

**Update `handleExportCsv()` → `handleExport(format: 'csv' | 'xlsx')`:**
```typescript
const handleExport = async (format: 'csv' | 'xlsx') => {
  const mimeType = format === 'csv'
    ? 'text/csv'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const extension = format === 'csv' ? 'csv' : 'xlsx';

  const response = await creditApi.get(`/reports/${activeTab}`, {
    params: { ...filters, format },
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credit-${activeTab}-report.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
  setShowExportMenu(false);
};
```

#### 5.3.5 Install exceljs

**Backend package.json:**
```bash
cd backend && npm install exceljs && npm install -D @types/exceljs
```

### Pitfalls

1. **Exceljs types** — `exceljs` ships its own TypeScript definitions. If `@types/exceljs` conflicts, remove the `@types` package and use the bundled types.
2. **Large datasets in XLSX** — Exceljs supports `worksheet.addRow()` row-by-row (streaming). Use this for reports with >1k rows to avoid memory spikes. For <1k rows, `addRows()` batch is fine.
3. **Number formatting in XLSX** — Monetary values should use `numFmt: '#,##0.00'` for MYR formatting. Percentages use `numFmt: '0.0%'`.
4. **CSV escaping** — Fields containing commas, quotes, or newlines must be wrapped in double quotes. Internal double quotes become `""`. The `generateCsv()` utility must handle this.
5. **Export audit** — Every export must call `exportAuditService.logExport()` before sending the response. If the log call fails, still send the export (don't block the user) — log the audit failure via console.error.
6. **Rate limiting** — XLSX generation is heavier than CSV. The existing `creditExportLimiter` applies; consider a stricter limit for XLSX if memory is a concern (prod server ~960MB RAM).
7. **BOM for CSV** — Prepend UTF-8 BOM (`\uFEFF`) to CSV output so Excel opens it correctly with Unicode characters (borrower names with special chars).

### Verification

1. `GET /api/v1/credit/reports/pipeline?format=csv` → CSV file downloads correctly
2. `GET /api/v1/credit/reports/pipeline?format=xlsx` → XLSX file downloads, opens in Excel/Numbers
3. `GET /api/v1/credit/reports/exposure?format=xlsx` → XLSX with sector/rating data
4. `GET /api/v1/credit/reports/approval-turnaround?format=xlsx` → XLSX with turnaround data
5. Frontend Export dropdown shows CSV + Excel options for all 3 report tabs
6. XLSX number formatting: amounts show comma separators, percentages show 1 decimal
7. CreditExportEvent records created for both CSV and XLSX exports
8. CSV opens correctly in Excel (BOM present, special characters preserved)

---

## Implementation Order (Dependency-Aware)

```
Step 1 ─ S5.1 Verification (0.5 day)
│   ├── Run through verification checklist
│   ├── Fix any gaps found in SpreadViewTable
│   └── Confirm multi-period view works for CORPORATE borrowers

Step 2 ─ S5.3 CSV Utility + exceljs install (1 day)
│   ├── npm install exceljs in backend
│   ├── Create csvExport.ts utility
│   ├── Create xlsxExport.ts utility
│   ├── Refactor inline CSV in pipeline/exposure routes to use utility
│   └── Test: CSV export still works for pipeline + exposure

Step 3 ─ S5.2 Approval Turnaround Backend (1 day)
│   ├── Add getApprovalTurnaround() to dashboard.service.ts
│   ├── Add route GET /approval-turnaround to reports.routes.ts
│   ├── Add Zod validation schema
│   ├── Add controller handler with CSV/XLSX support (using utilities from Step 2)
│   └── Test: API returns correct avg/median/P90 values

Step 4 ─ S5.2 Approval Turnaround Frontend (1 day)
│   ├── Add getApprovalTurnaround to credit.service.ts
│   ├── Add 'turnaround' tab to CreditReports.tsx
│   ├── Build summary cards, group selector, aggregation table, detail table
│   ├── Wire export dropdown with CSV + XLSX options
│   └── Test: End-to-end in browser

Step 5 ─ S5.3 Frontend Export Enhancement (0.5 day)
│   ├── Replace "Export CSV" button with Export dropdown (CSV + Excel)
│   ├── Update handleExport() to support xlsx format
│   └── Test: Both formats download correctly from all 3 tabs

Total: ~4 days (1 developer) or ~2.5 days with BE/FE split
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `PERCENTILE_CONT` fails on Prisma | High | Medium | Use `$queryRaw` tagged template — proven pattern in this codebase |
| exceljs adds significant bundle/memory | Low | Medium | XLSX generation is server-side only. Monitor prod memory. Streaming API for large reports. |
| Legacy apps missing `submittedAt` | Medium | Low | Fallback to AuditChain first transition event OR exclude from turnaround calc |
| CSV regression from refactoring | Medium | High | Test existing pipeline/exposure CSV exports after refactor before proceeding |
| No completed applications in test data | Medium | Low | Seed script should create at least 5 apps with APPROVED state and CreditDecision APPROVE records |

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/pages/credit/tabs/FinancialsTab.tsx` | MAY MODIFY | Polish only if verification finds gaps |
| `backend/src/credit/utils/csvExport.ts` | CREATE | Reusable CSV generation utility |
| `backend/src/credit/utils/xlsxExport.ts` | CREATE | Reusable XLSX generation utility (exceljs) |
| `backend/src/credit/services/dashboard.service.ts` | MODIFY | Add `getApprovalTurnaround()` method |
| `backend/src/credit/routes/reports.routes.ts` | MODIFY | Add `/approval-turnaround` route, add xlsx format support |
| `backend/src/credit/controllers/reports.controller.ts` | MODIFY | Add turnaround controller handler |
| `backend/package.json` | MODIFY | Add `exceljs` dependency |
| `frontend/src/services/credit.service.ts` | MODIFY | Add `getApprovalTurnaround()` API method |
| `frontend/pages/credit/CreditReports.tsx` | MODIFY | Add turnaround tab, export dropdown with xlsx |