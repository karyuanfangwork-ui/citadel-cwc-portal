import { CaMemoData, getCaMemoData } from './caMemoPdf.service';

// Re-export for convenience
export type ApprovalPackData = CaMemoData;
export { getCaMemoData };

const fmt = (v: any) => (v != null ? Number(v).toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '—');
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// Section anchors for sidebar navigation
export const APPROVAL_PACK_SECTIONS = [
  { id: 'header-background', label: 'Header & Background' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'way-out', label: 'Way Out' },
  { id: 'credit-bureau', label: 'Credit Bureau Checks' },
  { id: 'industry-outlook', label: 'Industry Outlook' },
  { id: 'risk-assessment', label: 'Risk Assessment' },
  { id: 'esg-assessment', label: 'ESG Assessment' },
  { id: 'sicr-assessment', label: 'SICR Assessment' },
  { id: 'signoff', label: 'Signoff' },
] as const;

/**
 * Builds the full Approval Pack HTML with named section anchors for
 * in-app sidebar navigation. Extends the CA Memo template with additional
 * approval-specific data.
 */
export function buildApprovalPackHtml(app: CaMemoData): string {
  const borrower = app.borrowerProfile?.account?.name ?? app.borrowerProfile?.contact
    ? `${app.borrowerProfile.contact?.firstName} ${app.borrowerProfile.contact?.lastName}`
    : 'Unknown Borrower';

  const signoffs = app.signoffs ?? [];
  const prepared = signoffs.find((s: any) => s.role === 'PREPARED_BY');
  const reviewed = signoffs.find((s: any) => s.role === 'REVIEWED_BY');
  const concurred = signoffs.find((s: any) => s.role === 'CONCURRED_BY');

  const sigRow = (_label: string, s: any) => s
    ? `<td><strong>${s.signedBy?.firstName} ${s.signedBy?.lastName}</strong><br/><small>${s.designationSnapshot}</small><br/><small>${fmtDate(s.signedAt)}</small></td>`
    : `<td><em style="color:#aaa">Unsigned</em></td>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Approval Pack — ${app.applicationNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px 30px; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 12px; font-weight: bold; background: #1a3a5c; color: white; padding: 4px 8px; margin: 16px 0 8px; }
  h3 { font-size: 11px; font-weight: bold; margin: 10px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f4f8; font-weight: bold; }
  .right { text-align: right; }
  .label { width: 180px; font-weight: bold; color: #555; }
  .hit-yes { color: red; font-weight: bold; }
  .hit-no { color: green; }
  .meta { text-align: center; font-size: 10px; color: #888; margin-bottom: 8px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<h1>Approval Pack</h1>
<p class="meta">${app.applicationNo} &nbsp;|&nbsp; ${fmtDate(new Date().toISOString())} &nbsp;|&nbsp; ${app.state}</p>

<h2 id="header-background">Section 1 — Header &amp; Background</h2>
<table>
  <tr><td class="label">Borrower</td><td>${borrower}</td><td class="label">CIF No</td><td>${app.cifNo ?? '—'}</td></tr>
  <tr><td class="label">Application No</td><td>${app.applicationNo}</td><td class="label">Application Type</td><td>${app.applicationType ?? '—'}</td></tr>
  <tr><td class="label">Account Classification</td><td>${app.accountClassification ?? '—'}</td><td class="label">Product Type</td><td>${app.productType}</td></tr>
  <tr><td class="label">Requested Amount</td><td>${fmt(app.requestedAmount)} ${app.currency}</td><td class="label">Tenor</td><td>${app.requestedTenor ? `${app.requestedTenor} months` : '—'}</td></tr>
  <tr><td class="label">Team Lead</td><td>${app.teamLeadName ?? '—'}</td><td class="label">Relationship Since</td><td>${fmtDate(app.relationshipSince)}</td></tr>
</table>
${app.preambleText ? `<h3>Preamble</h3><p>${app.preambleText}</p>` : ''}

<h2 id="parties">Section 2 — Parties</h2>
${(app as any).parties && (app as any).parties.length > 0 ? `<table>
  <tr><th>Name</th><th>Role</th><th>NRIC/ID</th><th>Email</th></tr>
  ${(app as any).parties.map((p: any) => `<tr><td>${p.partyName ?? '—'}</td><td>${p.partyRole ?? '—'}</td><td>${p.nric ?? '—'}</td><td>${p.email ?? '—'}</td></tr>`).join('')}
</table>` : '<p>—</p>'}

<h2 id="facilities">Section 3 — Facilities</h2>
<table>
  <tr><th>Facility Type</th><th>Amount</th><th>Tenor</th><th>Rate</th><th>Purpose</th></tr>
  ${(app.facilities ?? []).map((f: any) => `<tr><td>${f.facilityType}</td><td class="right">${fmt(f.amount)}</td><td>${f.tenorMonths ? `${f.tenorMonths}m` : '—'}</td><td>${f.ratePct ? `${f.ratePct}%` : '—'}</td><td>${f.purpose ?? '—'}</td></tr>`).join('')}
</table>

${app.requestItems && app.requestItems.length > 0 ? `<h3>Request Items</h3><table>
  <tr><th>Type</th><th>Approving Level</th><th>Rationale</th></tr>
  ${app.requestItems.map((r: any) => `<tr><td>${r.requestType ?? '—'}</td><td>${r.approvingLevel ?? '—'}</td><td>${r.rationale ?? '—'}</td></tr>`).join('')}
</table>` : ''}

${app.exposureSummary ? `<h3>Exposure Summary</h3><table>
  <tr><th>Bucket</th><th>Amount</th></tr>
  <tr><td>Secured (This App)</td><td class="right">${fmt(app.exposureSummary.thisAppSecured)}</td></tr>
  <tr><td>Unsecured (This App)</td><td class="right">${fmt(app.exposureSummary.thisAppUnsecured)}</td></tr>
  <tr><td>Total Secured</td><td class="right">${fmt(app.exposureSummary.customerTotalSecured)}</td></tr>
  <tr><td>Total Unsecured</td><td class="right">${fmt(app.exposureSummary.customerTotalUnsecured)}</td></tr>
</table>` : ''}

<h2 id="scoring">Section 4 — Scoring</h2>
${app.riskAssessments && app.riskAssessments.length > 0 ? `<table>
  <tr><th>Risk Category</th><th>Description</th><th>Mitigation</th></tr>
  ${app.riskAssessments.map((r: any) => `<tr><td>${r.riskCategory}</td><td>${r.description ?? '—'}</td><td>${r.mitigation ?? '—'}</td></tr>`).join('')}
</table>` : '<p>—</p>'}

<h2 id="ecl">Section 5 — ECL</h2>
${app.eclSnapshots && app.eclSnapshots.length > 0 ? `<table>
  <tr><th>Stage</th><th>ECL Amount</th><th>Date</th></tr>
  ${app.eclSnapshots.map((e: any) => `<tr><td>${e.stage ?? '—'}</td><td class="right">${fmt(e.eclAmount)}</td><td>${fmtDate(e.createdAt)}</td></tr>`).join('')}
</table>` : '<p>—</p>'}

<h2 id="collateral">Section 6 — Collateral</h2>
${app.facilities?.some((f: any) => f.collaterals && f.collaterals.length > 0) ? `<table>
  <tr><th>Type</th><th>Description</th><th>Value</th></tr>
  ${app.facilities.flatMap((f: any) => (f.collaterals ?? []).map((c: any) => `<tr><td>${c.collateralType ?? '—'}</td><td>${c.description ?? '—'}</td><td class="right">${fmt(c.valuation ?? c.marketValue)}</td></tr>`)).join('')}
</table>` : '<p>—</p>'}

<h2 id="way-out">Section 7 — Way Out</h2>
<table>
  <tr><td class="label">First Way Out</td><td>${app.firstWayOut ?? '—'}</td></tr>
  <tr><td class="label">Second Way Out</td><td>${app.secondWayOut ?? '—'}</td></tr>
  <tr><td class="label">Other Way Out</td><td>${app.otherWayOut ?? '—'}</td></tr>
</table>

<h2 id="conditions">Section 8 — Conditions</h2>
<p>—</p>

<h2 id="credit-bureau">Section 14 — Credit Bureau Checks</h2>
<table>
  <tr><th>Provider</th><th>Subject</th><th>Run Date</th><th>Hits</th><th>Findings</th></tr>
  ${(app.bureauChecks ?? []).map((c: any) => `<tr><td>${c.provider}</td><td>${c.subjectName ?? '—'}</td><td>${fmtDate(c.runDate)}</td><td class="${c.hasHits === true ? 'hit-yes' : c.hasHits === false ? 'hit-no' : ''}">${c.hasHits === true ? 'YES' : c.hasHits === false ? 'No' : '—'}</td><td>${c.findings ?? '—'}</td></tr>`).join('')}
</table>

<h2 id="industry-outlook">Section 15 — Industry Outlook</h2>
${app.industryAssessment ? `<table>
  <tr><td class="label">Sector</td><td>${app.industryAssessment.sectorName ?? '—'}</td><td class="label">Sub-sector</td><td>${app.industryAssessment.subsectorName ?? '—'}</td></tr>
  <tr><td class="label" colspan="1">Sector Outlook</td><td colspan="3">${app.industryAssessment.sectorOutlook ?? '—'}</td></tr>
  <tr><td class="label">Sub-sector Outlook</td><td colspan="3">${app.industryAssessment.subsectorOutlook ?? '—'}</td></tr>
</table>` : '<p>—</p>'}

<h2 id="risk-assessment">Section 16 — Risk Assessment</h2>
<table>
  <tr><th>Risk Category</th><th>Description</th><th>Mitigation</th></tr>
  ${(app.riskAssessments ?? []).map((r: any) => `<tr><td>${r.riskCategory}</td><td>${r.description ?? '—'}</td><td>${r.mitigation ?? '—'}</td></tr>`).join('')}
</table>

<h2 id="esg-assessment">Section 17 — ESG Assessment</h2>
${app.esgAssessment ? `<table>
  <tr><td class="label">Guiding Principle</td><td>${app.esgAssessment.assignedGp ?? '—'}</td><td class="label">ESG Category</td><td>${app.esgAssessment.assignedCategory ?? '—'}</td></tr>
  <tr><td class="label">Justification</td><td colspan="3">${app.esgAssessment.justification ?? '—'}</td></tr>
</table>` : '<p>—</p>'}

<h2 id="sicr-assessment">Section 18 — SICR Assessment</h2>
<table>
  <tr><th>Trigger Type</th><th>Has Hit</th><th>Triggering Event</th><th>Rationale</th><th>Classification</th></tr>
  ${(app.sicrAssessments ?? []).map((s: any) => `<tr><td>${s.triggerType}</td><td>${s.hasHit === true ? 'YES' : s.hasHit === false ? 'No' : '—'}</td><td>${s.triggeringEvent ?? '—'}</td><td>${s.rationale ?? '—'}</td><td>${s.classification ?? '—'}</td></tr>`).join('')}
</table>

<h2 id="signoff">Section 19 — Signoff</h2>
<table>
  <tr><th>Role</th><th>Signee</th><th>Designation</th><th>Date</th></tr>
  <tr><td>Prepared By</td>${sigRow('Prepared By', prepared)}</tr>
  <tr><td>Reviewed By</td>${sigRow('Reviewed By', reviewed)}</tr>
  <tr><td>Concurred By</td>${sigRow('Concurred By', concurred)}</tr>
</table>

</body>
</html>`;
}