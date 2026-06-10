/**
 * requestPdf.service.ts — Generate a PDF for a single helpdesk ticket.
 *
 * Reuses the credit module's `htmlToPdf()` (puppeteer-core) to render
 * a styled HTML template into an A4 PDF buffer.
 */

import { htmlToPdf } from '../credit/services/htmlToPdf.service';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';
import escapeHtml from 'escape-html';

// ── Types ────────────────────────────────────────────────────────────────
interface RequestForPdf {
  id: string;
  referenceNumber: string;
  summary: string;
  description?: string;
  status: string;
  priority: string;
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
  slaDueAt?: Date | null;
  slaPausedAt?: Date | null;
  customFields?: Record<string, any> | null;
  requester?: { firstName: string; lastName: string; email: string } | null;
  assignedTo?: { firstName: string; lastName: string; email: string } | null;
  assignedTeam?: string | null;
  serviceDesk?: { code: string; name: string } | null;
  requestType?: { name: string } | null;
  approvals?: { approver?: { firstName: string; lastName: string }; status: string; createdAt: Date }[];
  participants?: { user?: { firstName: string; lastName: string; email: string } }[];
  activities?: { authorName: string; activityType: string; message: string; createdAt: Date; isInternal: boolean }[];
  requestTypeWorkflowSteps?: { name: string; displayOrder: number }[];
}

// ── Data Fetching ─────────────────────────────────────────────────────────
export async function getRequestDataForPdf(idOrRef: string): Promise<RequestForPdf> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  const lookupKey = isUuid ? { id: idOrRef } : { referenceNumber: idOrRef };

  const request = await prisma.request.findFirst({
    where: { ...lookupKey, deletedAt: null },
    include: {
      requester: { select: { firstName: true, lastName: true, email: true } },
      assignedTo: { select: { firstName: true, lastName: true, email: true } },
      serviceDesk: true,
      requestType: {
        include: {
          workflow: {
            include: { steps: { orderBy: { displayOrder: 'asc' } } },
          },
        },
      },
      approvals: {
        include: { approver: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      participants: {
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        where: { isInternal: false }, // only public activities in PDF
      },
    },
  });

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Flatten workflow steps from requestType
  const workflowSteps = (request as any).requestType?.workflow?.steps?.map(
    (s: any) => ({ name: s.name, displayOrder: s.displayOrder })
  ) ?? [];

  return {
    ...request,
    requestTypeWorkflowSteps: workflowSteps,
  } as unknown as RequestForPdf;
}

// ── HTML Template ─────────────────────────────────────────────────────────
function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('RESOLVED') || s.includes('COMPLETE') || s.includes('APPROVED')) return '#16a34a';
  if (s.includes('PENDING') || s.includes('SUBMITTED')) return '#d97706';
  if (s.includes('REJECTED') || s.includes('CANCEL')) return '#dc2626';
  return '#6b7280';
}

function priorityColor(priority: string): string {
  const p = priority.toUpperCase();
  if (p === 'URGENT') return '#dc2626';
  if (p === 'HIGH') return '#ea580c';
  if (p === 'MEDIUM') return '#d97706';
  return '#6b7280';
}

function buildHtml(req: RequestForPdf): string {
  const confidentialWatermark = req.isConfidential
    ? `<div style="position:fixed; top:40%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-size:90px; color:rgba(220,38,38,0.12); font-weight:bold; pointer-events:none; z-index:0; white-space:nowrap;">CONFIDENTIAL</div>`
    : '';

  const requesterName = req.requester
    ? `${escapeHtml(req.requester.firstName)} ${escapeHtml(req.requester.lastName)}`
    : '—';
  const requesterEmail = req.requester?.email ? escapeHtml(req.requester.email) : '';
  const assigneeName = req.assignedTo
    ? `${escapeHtml(req.assignedTo.firstName)} ${escapeHtml(req.assignedTo.lastName)}`
    : req.assignedTeam || 'Unassigned';

  // Custom fields
  let customFieldsHtml = '';
  if (req.customFields && typeof req.customFields === 'object') {
    const entries = Object.entries(req.customFields).filter(([, v]) => v != null && v !== '');
    if (entries.length > 0) {
      customFieldsHtml = `
        <div class="section">
          <h2>Custom Fields</h2>
          <table class="kv-table">
            ${entries.map(([k, v]) => `<tr><td class="kv-key">${escapeHtml(k)}</td><td class="kv-val">${escapeHtml(String(v))}</td></tr>`).join('')}
          </table>
        </div>`;
    }
  }

  // Workflow steps
  let workflowHtml = '';
  if (req.requestTypeWorkflowSteps && req.requestTypeWorkflowSteps.length > 0) {
    workflowHtml = `
      <div class="section">
        <h2>Workflow</h2>
        <div class="workflow-steps">
          ${req.requestTypeWorkflowSteps.map(s => `<div class="step">${escapeHtml(s.name)}</div>`).join('<div class="step-arrow">→</div>')}
        </div>
      </div>`;
  }

  // Approvals
  let approvalsHtml = '';
  if (req.approvals && req.approvals.length > 0) {
    approvalsHtml = `
      <div class="section">
        <h2>Approvals</h2>
        <table class="data-table">
          <thead><tr><th>Approver</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${req.approvals.map(a => {
              const name = a.approver ? `${escapeHtml(a.approver.firstName)} ${escapeHtml(a.approver.lastName)}` : '—';
              return `<tr><td>${name}</td><td style="color:${statusColor(a.status)}">${formatStatus(a.status)}</td><td>${formatDate(a.createdAt)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // Participants
  let participantsHtml = '';
  if (req.participants && req.participants.length > 0) {
    participantsHtml = `
      <div class="section">
        <h2>Participants</h2>
        <div class="participants-list">
          ${req.participants.map(p => {
            const name = p.user ? `${escapeHtml(p.user.firstName)} ${escapeHtml(p.user.lastName)}` : '—';
            const email = p.user?.email ? ` (${escapeHtml(p.user.email)})` : '';
            return `<span class="participant-chip">${name}${email}</span>`;
          }).join(' ')}
        </div>
      </div>`;
  }

  // Activity log (last 20, public only)
  let activityHtml = '';
  if (req.activities && req.activities.length > 0) {
    activityHtml = `
      <div class="section">
        <h2>Activity Log (last 20)</h2>
        <table class="data-table activity-table">
          <thead><tr><th>Date</th><th>Author</th><th>Type</th><th>Message</th></tr></thead>
          <tbody>
            ${req.activities.map(a => `
              <tr>
                <td class="nowrap">${formatDate(a.createdAt)}</td>
                <td>${escapeHtml(a.authorName)}</td>
                <td>${formatStatus(a.activityType)}</td>
                <td>${escapeHtml((a.message || '').substring(0, 200))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page { margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #1f2937; line-height: 1.5; position: relative; }
  ${confidentialWatermark ? 'body::after { content: ""; position: fixed; top:0; left:0; right:0; bottom:0; z-index: -1; }' : ''}

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0052cc; padding-bottom: 12px; margin-bottom: 20px; }
  .header-left h1 { font-size: 18px; font-weight: 700; color: #0052cc; margin-bottom: 2px; }
  .header-left .ref { font-size: 13px; color: #6b7280; }
  .header-right { text-align: right; font-size: 10px; color: #9ca3af; }

  .section { margin-bottom: 16px; page-break-inside: avoid; }
  .section h2 { font-size: 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }

  .kv-table { width: 100%; border-collapse: collapse; }
  .kv-table td { padding: 4px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .kv-key { width: 160px; font-weight: 600; color: #6b7280; font-size: 10px; text-transform: uppercase; }
  .kv-val { color: #1f2937; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .data-table th { background: #f9fafb; text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 2px solid #e5e7eb; color: #374151; }
  .data-table td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
  .activity-table td:nth-child(4) { max-width: 300px; word-wrap: break-word; }

  .workflow-steps { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
  .step { background: #f0f5ff; color: #0052cc; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 500; }
  .step-arrow { color: #d1d5db; font-size: 10px; }

  .participants-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .participant-chip { background: #f3f4f6; color: #374151; padding: 3px 10px; border-radius: 12px; font-size: 10px; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .nowrap { white-space: nowrap; }

  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
  ${confidentialWatermark}

  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(req.summary)}</h1>
      <div class="ref">${escapeHtml(req.referenceNumber)} &middot; ${req.serviceDesk ? escapeHtml(req.serviceDesk.name) : ''} ${req.requestType ? '&middot; ' + escapeHtml(req.requestType.name) : ''}</div>
    </div>
    <div class="header-right">
      Citadel Workplace Connect<br>
      Generated: ${formatDate(new Date())}
    </div>
  </div>

  <div class="section">
    <h2>Details</h2>
    <table class="kv-table">
      <tr><td class="kv-key">Status</td><td><span class="badge" style="background:${statusColor(req.status)}20; color:${statusColor(req.status)}">${formatStatus(req.status)}</span></td></tr>
      <tr><td class="kv-key">Priority</td><td><span class="badge" style="background:${priorityColor(req.priority)}20; color:${priorityColor(req.priority)}">${escapeHtml(req.priority)}</span></td></tr>
      <tr><td class="kv-key">Confidential</td><td>${req.isConfidential ? 'Yes' : 'No'}</td></tr>
      <tr><td class="kv-key">Requester</td><td>${requesterName}${requesterEmail ? ' (' + requesterEmail + ')' : ''}</td></tr>
      <tr><td class="kv-key">Assigned To</td><td>${assigneeName}</td></tr>
      <tr><td class="kv-key">Created</td><td>${formatDate(req.createdAt)}</td></tr>
      <tr><td class="kv-key">Updated</td><td>${formatDate(req.updatedAt)}</td></tr>
      <tr><td class="kv-key">SLA Due</td><td>${req.slaDueAt ? formatDate(req.slaDueAt) : '—'}${req.slaPausedAt ? ' (Paused)' : ''}</td></tr>
    </table>
  </div>

  ${req.description ? `<div class="section"><h2>Description</h2><p style="white-space:pre-wrap; word-break:break-word;">${escapeHtml(req.description)}</p></div>` : ''}

  ${customFieldsHtml}
  ${workflowHtml}
  ${approvalsHtml}
  ${participantsHtml}
  ${activityHtml}

  <div class="footer">
    This document was generated by Citadel Workplace Connect on ${formatDate(new Date())}.
    ${req.isConfidential ? '⚠ CONFIDENTIAL — For authorized recipients only.' : ''}
  </div>
</body>
</html>`;
}

// ── PDF Generation ────────────────────────────────────────────────────────
export async function generateRequestPdf(idOrRef: string): Promise<Buffer> {
  const requestData = await getRequestDataForPdf(idOrRef);
  const html = buildHtml(requestData);
  return htmlToPdf(html);
}