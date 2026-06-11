import { Router, Request, Response } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { creditExportLimiter } from '../../middleware/rateLimit.middleware';
import { dashboardService } from '../services/dashboard.service';
import { generateCsv, sendCsvResponse } from '../utils/csvExport';
import { generateXlsx, sendXlsxResponse } from '../utils/xlsxExport';
import { logCreditExport } from '../services/exportAudit.service';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// ---------------------------------------------------------------------------
// Shared types & helpers — §5.3
// ---------------------------------------------------------------------------

type ExportFormat = 'json' | 'csv' | 'xlsx';

interface AuthedRequest extends Request {
  user?: { id: string; [key: string]: unknown };
}

function getFormat(req: Request): ExportFormat {
  return (req.query.format as ExportFormat) || 'json';
}

function getUserId(req: AuthedRequest): string {
  return req.user?.id ?? 'unknown';
}

async function handleExport(
  res: Response,
  format: 'csv' | 'xlsx',
  headers: string[],
  rows: (string | number | null)[][],
  filename: string,
  userId: string,
  reportType: string,
  filters: Record<string, unknown>,
): Promise<void> {
  if (format === 'csv') {
    const csv = generateCsv({ headers, rows, filename });
    try { await logCreditExport({ userId, reportType, format: 'csv', filters, rowCount: rows.length }); } catch {}
    sendCsvResponse(res, csv, filename);
    return;
  }

  if (format === 'xlsx') {
    const buffer = await generateXlsx({ headers, rows, filename, sheetName: reportType });
    try { await logCreditExport({ userId, reportType, format: 'xlsx', filters, rowCount: rows.length }); } catch {}
    sendXlsxResponse(res, buffer, filename);
    return;
  }
}

// ---------------------------------------------------------------------------
// Pipeline report — aggregated counts by state, SLA breach info
// ---------------------------------------------------------------------------

router.get('/pipeline', creditExportLimiter, requirePermission('credit:read'), async (req: AuthedRequest, res) => {
  const format = getFormat(req);
  const filters = {
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    branchId: req.query.branchId as string | undefined,
  };
  const data = await dashboardService.getPipelineDashboard(filters);

  if (format !== 'json') {
    const headers = ['State', 'Count', 'Avg Days In State'];
    const rows = data.states.map(s => [s.state, s.count, s.avgDaysInState] as (string | number | null)[]);
    // Add SLA breach summary row
    rows.push([] as (string | number | null)[]);
    rows.push(['SLA Breaches', data.slaBreachCount, ''] as (string | number | null)[]);
    // Add breach detail line items
    if (data.slaBreaches.length > 0) {
      rows.push([] as (string | number | null)[]);
      rows.push(['Application No', 'Borrower', 'Current State', 'Days Overdue', 'Policy'] as (string | number | null)[]);
      for (const b of data.slaBreaches) {
        rows.push([b.applicationNo, b.borrowerName, b.currentState, b.daysOverdue, b.policyName] as (string | number | null)[]);
      }
    }
    return handleExport(res, format as 'csv' | 'xlsx', headers, rows, 'pipeline-report', getUserId(req), 'pipeline', filters);
  }

  res.json({ status: 'success', data });
});

// ---------------------------------------------------------------------------
// Exposure report — top borrowers, sector breakdown, rating distribution
// ---------------------------------------------------------------------------

router.get('/exposure', creditExportLimiter, requirePermission('credit:read'), async (req: AuthedRequest, res) => {
  const format = getFormat(req);
  const filters = {
    topN: req.query.topN ? Number(req.query.topN) : undefined,
    branchId: req.query.branchId as string | undefined,
  };
  const data = await dashboardService.getExposureDashboard(filters);

  if (format !== 'json') {
    // Separate sections for borrowers and sectors with correct headers
    const headers = ['Section', 'Name', 'Sector', 'Rating', 'Exposure', 'Borrowers'];
    const rows: (string | number | null)[][] = [];

    // Borrower section
    rows.push(['--- Top Borrowers ---', '', '', '', '', ''] as (string | number | null)[]);
    rows.push(['Borrower', 'Name', 'Sector', 'Rating', 'Exposure', ''] as (string | number | null)[]);
    for (const b of data.topBorrowers) {
      rows.push(['Borrower', b.borrowerName, b.industry || 'Unknown', b.rating || 'NR', b.totalExposure, ''] as (string | number | null)[]);
    }

    // Blank separator
    rows.push([] as (string | number | null)[]);

    // Sector section
    rows.push(['--- Sector Breakdown ---', '', '', '', '', ''] as (string | number | null)[]);
    rows.push(['Sector', 'Sector', '', '', 'Exposure', 'Borrowers'] as (string | number | null)[]);
    for (const s of data.sectorBreakdown) {
      rows.push(['Sector', s.sector, '', '', s.totalExposure, s.count] as (string | number | null)[]);
    }

    return handleExport(res, format as 'csv' | 'xlsx', headers, rows, 'exposure-report', getUserId(req), 'exposure', filters);
  }

  res.json({ status: 'success', data });
});

// ---------------------------------------------------------------------------
// Approval Turnaround Report — §5.2
// ---------------------------------------------------------------------------

const turnaroundFilterSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  productType: z.string().optional(),
  rmId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  groupBy: z.enum(['product', 'month', 'rm']).default('month'),
  format: z.enum(['json', 'csv', 'xlsx']).default('json'),
});

router.get('/approval-turnaround', creditExportLimiter, requirePermission('credit:read'), async (req: AuthedRequest, res) => {
  const parsed = turnaroundFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ status: 'error', message: 'Invalid filter parameters', details: parsed.error.flatten() });
  }

  const { format, ...filterParams } = parsed.data;
  const data = await dashboardService.getApprovalTurnaround({
    dateFrom: filterParams.dateFrom,
    dateTo: filterParams.dateTo,
    productType: filterParams.productType,
    rmId: filterParams.rmId,
    branchId: filterParams.branchId,
    groupBy: filterParams.groupBy,
  });

  if (format !== 'json') {
    const headers = ['Application No', 'Borrower', 'Product Type', 'RM', 'Submitted', 'Decision Date', 'Turnaround Days', 'Decision'];
    const rows = data.applications.map(a => [
      a.applicationNo,
      a.borrowerName,
      a.productType,
      a.rmName,
      a.submittedAt.slice(0, 10),
      a.firstApprovalAt.slice(0, 10),
      a.turnaroundDays,
      a.decision,
    ] as (string | number | null)[]);
    return handleExport(res, format as 'csv' | 'xlsx', headers, rows, 'approval-turnaround-report', getUserId(req), 'approval-turnaround', filterParams as Record<string, unknown>);
  }

  res.json({ status: 'success', data });
});

export default router;