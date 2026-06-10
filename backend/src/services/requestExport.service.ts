/**
 * requestExport.service.ts — Export multiple tickets as XLSX.
 *
 * Uses exceljs (already installed for credit module).
 * 15 columns: Reference, Summary, Status, Priority, Service Desk,
 * Request Type, Requester, Requester Email, Assigned To, Assigned Team,
 * Created, Updated, SLA Due, SLA Paused, Confidential.
 */

import ExcelJS from 'exceljs';
import prisma from '../utils/prisma';

// ── Column Definitions ────────────────────────────────────────────────────
const COLUMNS = [
  { header: 'Reference', key: 'reference', width: 14 },
  { header: 'Summary', key: 'summary', width: 35 },
  { header: 'Status', key: 'status', width: 22 },
  { header: 'Priority', key: 'priority', width: 12 },
  { header: 'Service Desk', key: 'serviceDesk', width: 16 },
  { header: 'Request Type', key: 'requestType', width: 22 },
  { header: 'Requester', key: 'requester', width: 20 },
  { header: 'Requester Email', key: 'requesterEmail', width: 28 },
  { header: 'Assigned To', key: 'assignedTo', width: 20 },
  { header: 'Assigned Team', key: 'assignedTeam', width: 18 },
  { header: 'Created', key: 'created', width: 20 },
  { header: 'Updated', key: 'updated', width: 20 },
  { header: 'SLA Due', key: 'slaDue', width: 20 },
  { header: 'SLA Paused', key: 'slaPaused', width: 13 },
  { header: 'Confidential', key: 'confidential', width: 14 },
] as const;

// ── Status/priority color maps ────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'FFD97706', PENDING: 'FFD97706',
  ACKNOWLEDGED: 'FF2563EB', IN_PROGRESS: 'FF2563EB',
  PENDING_CEO_APPROVAL: 'FFD97706', PENDING_CTO_APPROVAL: 'FFD97706',
  PENDING_CFO_APPROVAL: 'FFD97706', CEO_APPROVED: 'FF16A34A',
  CTO_APPROVED: 'FF16A34A', CFO_APPROVED: 'FF16A34A',
  CEO_REJECTED: 'FFDC2626', CTO_REJECTED: 'FFDC2626',
  RESOLVED: 'FF16A34A', COMPLETED: 'FF16A34A', CLOSED: 'FF6B7280',
  CANCELLED: 'FF6B7280',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'FFDC2626', HIGH: 'FFEA580C', MEDIUM: 'FFD97706', LOW: 'FF6B7280',
};

// ── Data Fetching ──────────────────────────────────────────────────────────
export async function fetchRequestsForExport(ids: string[]): Promise<any[]> {
  return prisma.request.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
    },
    include: {
      requester: { select: { firstName: true, lastName: true, email: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      serviceDesk: { select: { name: true } },
      requestType: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Excel Generation ───────────────────────────────────────────────────────
export async function generateRequestsXlsx(ids: string[]): Promise<Buffer> {
  const requests = await fetchRequestsForExport(ids);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CWC Helpdesk';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Tickets');

  // Define columns
  (worksheet as any).columns = COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0052CC' }, // CWC blue
  };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 24;

  // Add data rows
  for (const req of requests) {
    const row = worksheet.addRow({
      reference: req.referenceNumber,
      summary: req.summary,
      status: formatStatus(req.status),
      priority: req.priority,
      serviceDesk: req.serviceDesk?.name ?? '—',
      requestType: req.requestType?.name ?? '—',
      requester: req.requester ? `${req.requester.firstName} ${req.requester.lastName}` : '—',
      requesterEmail: req.requester?.email ?? '—',
      assignedTo: req.assignedTo ? `${req.assignedTo.firstName} ${req.assignedTo.lastName}` : '—',
      assignedTeam: req.assignedTeam ?? '—',
      created: formatDate(req.createdAt),
      updated: formatDate(req.updatedAt),
      slaDue: req.slaDueAt ? formatDate(req.slaDueAt) : '—',
      slaPaused: req.slaPausedAt ? 'Yes' : 'No',
      confidential: req.isConfidential ? 'Yes' : 'No',
    });

    // Conditional formatting — color status cell
    const statusCell = row.getCell(3); // Status column
    const statusArgb = STATUS_COLORS[req.status];
    if (statusArgb) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusArgb } };
      statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }

    // Conditional formatting — color priority cell
    const priorityCell = row.getCell(4); // Priority column
    const priorityArgb = PRIORITY_COLORS[req.priority];
    if (priorityArgb) {
      priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: priorityArgb } };
      priorityCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }

    // Confidential row highlight
    if (req.isConfidential) {
      row.getCell(15).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  }

  // Freeze header row + add auto-filter
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: requests.length + 1, column: COLUMNS.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}