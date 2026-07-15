import { Request, Response, NextFunction } from 'express';
import { getCaMemoData } from '../services/caMemoPdf.service';
import { getLockedMemoVersion, generateAndSaveMemoVersion } from '../services/creditMemoVersion.service';

const fmt = (v: any) => (v != null ? Number(v).toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '—');
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const esc = (s: any) => (s != null ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildHtml(app: any, title: string): string {
  const borrower = app.borrowerProfile?.name ?? 'Unknown Borrower';

  const signoffs = app.signoffs ?? [];
  const prepared = signoffs.find((s: any) => s.role === 'PREPARED_BY');
  const reviewed = signoffs.find((s: any) => s.role === 'REVIEWED_BY');
  const concurred = signoffs.find((s: any) => s.role === 'CONCURRED_BY');

  const latestScore = app.scoreRuns?.[0] ?? null;
  const riskRating = app.riskRating ?? latestScore?.overriddenRating ?? latestScore?.riskRating ?? '—';

  const rmName = app.assignedRm ? `${app.assignedRm.firstName} ${app.assignedRm.lastName}` : '—';
  const analystName = app.assignedAnalyst ? `${app.assignedAnalyst.firstName} ${app.assignedAnalyst.lastName}` : '—';

  const sigRow = (_label: string, s: any) => s
    ? `<td><strong>${esc(s.signedBy?.firstName)} ${esc(s.signedBy?.lastName)}</strong><br/><small>${esc(s.designationSnapshot)}</small><br/><small>${fmtDate(s.signedAt)}</small></td>`
    : `<td><em style="color:#aaa">Unsigned</em></td>`;

  const connFlag = app.connectedPartyFlag
    ? `<span class="hit-yes">YES</span>${app.connectedPartyStaffName ? ` — ${esc(app.connectedPartyStaffName)}` : ''}`
    : `<span class="hit-no">No</span>`;

  const strategyLabel = app.accountStrategy ?? '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px 30px; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 12px; font-weight: bold; background: #1a3a5c; color: white; padding: 4px 8px; margin: 16px 0 8px; }
  h3 { font-size: 11px; font-weight: bold; margin: 10px 0 4px; }
  h4 { font-size: 11px; font-weight: bold; color: #333; margin: 8px 0 3px; }
  p { margin-bottom: 6px; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f4f8; font-weight: bold; }
  .right { text-align: right; }
  .label { width: 180px; font-weight: bold; color: #555; }
  .hit-yes { color: red; font-weight: bold; }
  .hit-no { color: green; }
  .meta { text-align: center; font-size: 10px; color: #888; margin-bottom: 8px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-weight: bold; font-size: 10px; }
  .badge-grow { background: #d4edda; color: #155724; }
  .badge-maintain { background: #fff3cd; color: #856404; }
  .badge-exit { background: #f8d7da; color: #721c24; }
  .section-empty { color: #999; font-style: italic; padding: 4px 0; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<h1>Credit Assessment Memorandum</h1>
<p class="meta">${esc(app.applicationNo)} &nbsp;|&nbsp; ${fmtDate(new Date().toISOString())} &nbsp;|&nbsp; ${app.state}</p>

<!-- ═══════════ S1 — Loan Request ═══════════ -->
<h2>S1 — Loan Request &amp; Facilities</h2>
<h3>Application Header</h3>
<table>
  <tr><td class="label">Borrower</td><td>${esc(borrower)}</td><td class="label">Customer Group</td><td>${esc(app.customerGroupName)}</td></tr>
  <tr><td class="label">CIF No</td><td>${esc(app.cifNo)}</td><td class="label">Application No</td><td>${esc(app.applicationNo)}</td></tr>
  <tr><td class="label">Application Type</td><td>${esc(app.applicationType)}</td><td class="label">Product Type</td><td>${esc(app.productType)}</td></tr>
  <tr><td class="label">Requested Amount</td><td>${fmt(app.requestedAmount)} ${esc(app.currency)}</td><td class="label">Tenor</td><td>${app.requestedTenor ? `${app.requestedTenor} months` : '—'}</td></tr>
  <tr><td class="label">Purpose</td><td colspan="3">${esc(app.purpose)}</td></tr>
  <tr><td class="label">Account Classification</td><td>${esc(app.accountClassification)}</td><td class="label">Connected Party</td><td>${connFlag}</td></tr>
  <tr><td class="label">Originating Dept</td><td>${esc(app.originatingDepartment)}</td><td class="label">Referred By</td><td>${esc(app.referredBy)}</td></tr>
  <tr><td class="label">Team Lead</td><td>${esc(app.teamLeadName)}</td><td class="label">Relationship Since</td><td>${fmtDate(app.relationshipSince)}</td></tr>
  <tr><td class="label">Complete Docs Date</td><td>${fmtDate(app.completeDocsDate)}</td><td class="label">Last Review Date</td><td>${fmtDate(app.lastReviewDate)}</td></tr>
  <tr><td class="label">Next Review Date</td><td>${fmtDate(app.nextReviewDate)}</td><td class="label">Last Site Visit</td><td>${fmtDate(app.lastSiteVisitDate)}</td></tr>
  <tr><td class="label">Relationship Manager</td><td>${esc(rmName)}</td><td class="label">Credit Analyst</td><td>${esc(analystName)}</td></tr>
</table>

${app.preambleText ? `<h3>Preamble</h3><p>${esc(app.preambleText)}</p>` : ''}
${app.mattersToHighlight ? `<h3>Matters to Highlight</h3><p>${esc(app.mattersToHighlight)}</p>` : ''}
${app.transactionDetailsText ? `<h3>Transaction Details</h3><p>${esc(app.transactionDetailsText)}</p>` : ''}

<h3>Facilities</h3>
${(app.facilities ?? []).length > 0 ? `<table>
  <tr><th>Facility Type</th><th>Existing Limit</th><th>Proposed Change</th><th>New Limit</th><th>Approved Amount</th><th>Tenor</th><th>Rate</th><th>Purpose</th></tr>
  ${(app.facilities ?? []).map((f: any) => `<tr><td>${esc(f.facilityType)}</td><td class="right">${fmt(f.existingLimit)}</td><td class="right">${fmt(f.proposedChange)}</td><td class="right">${fmt(f.newLimit)}</td><td class="right">${fmt(f.approvedAmount)}</td><td>${f.approvedTenor ?? f.tenorMonths ? `${f.approvedTenor ?? f.tenorMonths}m` : '—'}</td><td>${f.approvedRate ?? f.ratePct ? `${f.approvedRate ?? f.ratePct}%` : '—'}</td><td>${esc(f.purpose)}</td></tr>`).join('')}
</table>` : '<p class="section-empty">No facilities recorded.</p>'}

<!-- ═══════════ S2 — Borrower Profile ═══════════ -->
<h2>S2 — Borrower Profile</h2>
<h3>Borrower Details</h3>
<table>
  <tr><td class="label">Borrower Name</td><td>${esc(app.borrowerProfile?.name)}</td><td class="label">Registration No</td><td>${esc(app.borrowerProfile?.registrationNumber)}</td></tr>
  <tr><td class="label">Industry</td><td>${esc(app.borrowerProfile?.industry)}</td><td class="label">Borrower Type</td><td>${esc(app.borrowerProfile?.borrowerType)}</td></tr>
</table>

${(app.borrowerProfile?.directors ?? []).length > 0 ? `<h3>Directors</h3>
<table>
  <tr><th>Name</th><th>Position</th><th>IC/Passport</th></tr>
  ${app.borrowerProfile.directors.map((d: any) => `<tr><td>${esc(d.name)}</td><td>${esc(d.position)}</td><td>${esc(d.icPassport)}</td></tr>`).join('')}
</table>` : ''}

${(app.borrowerProfile?.shareholders ?? []).length > 0 ? `<h3>Shareholders</h3>
<table>
  <tr><th>Name</th><th>Shareholding %</th><th>Type</th></tr>
  ${app.borrowerProfile.shareholders.map((s: any) => `<tr><td>${esc(s.name)}</td><td class="right">${s.shareholdingPct != null ? Number(s.shareholdingPct).toFixed(2) + '%' : '—'}</td><td>${esc(s.shareholderType)}</td></tr>`).join('')}
</table>` : ''}

${(app.parties ?? []).length > 0 ? `<h3>Key Parties &amp; UBOs</h3>
<table>
  <tr><th>Name</th><th>Role</th><th>ID Type</th><th>ID Number</th><th>Nationality</th></tr>
  ${app.parties.map((p: any) => {
     const partyName = p.borrowerProfile?.name ?? '—';
     return `<tr><td>${esc(partyName)}</td><td>${esc(p.role)}</td><td>—</td><td>—</td><td>—</td></tr>`;
  }).join('')}
</table>` : ''}

<!-- ═══════════ S3 — Financials ═══════════ -->
<h2>S3 — Financials</h2>
${(app.borrowerProfile?.financialStatements ?? []).length > 0 ? `
<h3>Financial Statements</h3>
${app.borrowerProfile.financialStatements.map((fs: any) => `
<h4>${fmtDate(fs.fiscalYearEnd)} — ${esc(fs.statementType)} ${fs.isDraftAccounts ? '(Draft)' : ''} ${fs.isQualified ? '⚠ Qualified' : ''}</h4>
${fs.auditorName ? `<p>Auditor: ${esc(fs.auditorName)}</p>` : ''}
${(fs.lineItems ?? []).length > 0 ? `<table>
  <tr><th>Item</th><th class="right">Amount (${esc(fs.currency ?? app.currency)})</th></tr>
  ${fs.lineItems.map((li: any) => `<tr><td>${esc(li.lineLabel)}</td><td class="right">${fmt(li.amount)}</td></tr>`).join('')}
</table>` : '<p class="section-empty">No line items.</p>'}
${fs.commentarySalesProfitability ? `<p><em>Sales/Profitability: ${esc(fs.commentarySalesProfitability)}</em></p>` : ''}
${fs.commentaryAssetMgmt ? `<p><em>Asset Mgmt: ${esc(fs.commentaryAssetMgmt)}</em></p>` : ''}
${fs.commentaryDebtMgmt ? `<p><em>Debt Mgmt: ${esc(fs.commentaryDebtMgmt)}</em></p>` : ''}
${fs.commentaryCashflow ? `<p><em>Cashflow: ${esc(fs.commentaryCashflow)}</em></p>` : ''}
`).join('')}` : '<p class="section-empty">No financial statements recorded.</p>'}

${(app.externalRatings ?? []).length > 0 ? `<h3>External Ratings</h3>
<table>
  <tr><th>Agency</th><th>Subject</th><th>Rating</th><th>Outlook</th><th>Fiscal Year</th><th>Date</th></tr>
  ${app.externalRatings.map((r: any) => `<tr><td>${esc(r.agency)}</td><td>${esc(r.subjectName)}</td><td><strong>${esc(r.rating)}</strong></td><td>${esc(r.outlook)}</td><td>${r.fiscalYear ?? '—'}</td><td>${fmtDate(r.ratingDate)}</td></tr>`).join('')}
</table>` : ''}

${(app.exposureSummary) ? `<h3>Exposure Summary</h3>
<table>
  <tr><th></th><th class="right">Secured</th><th class="right">Unsecured</th></tr>
  <tr><td class="label">This Application</td><td class="right">${fmt(app.exposureSummary.thisAppSecured)}</td><td class="right">${fmt(app.exposureSummary.thisAppUnsecured)}</td></tr>
  <tr><td class="label">Other Applications</td><td class="right">${fmt(app.exposureSummary.otherAppSecured)}</td><td class="right">${fmt(app.exposureSummary.otherAppUnsecured)}</td></tr>
  <tr><td class="label">Customer Total</td><td class="right">${fmt(app.exposureSummary.customerTotalSecured)}</td><td class="right">${fmt(app.exposureSummary.customerTotalUnsecured)}</td></tr>
  <tr><td class="label">Related Counterparty</td><td class="right">${fmt(app.exposureSummary.relatedCounterpartySecured)}</td><td class="right">${fmt(app.exposureSummary.relatedCounterpartyUnsecured)}</td></tr>
  <tr><td class="label">Group Total</td><td class="right">${fmt(app.exposureSummary.groupTotalSecured)}</td><td class="right">${fmt(app.exposureSummary.groupTotalUnsecured)}</td></tr>
</table>` : ''}

<!-- ═══════════ S4 — Risk Score ═══════════ -->
<h2>S4 — Risk Score &amp; Rating</h2>
<table>
  <tr><td class="label">Risk Rating</td><td><strong>${esc(riskRating)}</strong></td><td class="label">Total Score</td><td>${latestScore ? latestScore.totalScore : '—'}</td></tr>
</table>

${latestScore ? `
<h3>Latest Scorecard Result</h3>
<table>
  <tr><th>Factor</th><th>Score</th><th>Weight</th><th>Weighted Score</th></tr>
  ${(latestScore.factorBreakdown ?? []).map((fb: any) => `<tr><td>${esc(fb.factorLabel)}</td><td class="right">${fb.score?.toFixed(0) ?? '—'}</td><td class="right">${fb.weight}%</td><td class="right">${fb.weightedScore?.toFixed(1) ?? '—'}</td></tr>`).join('')}
</table>
${latestScore.overriddenRating ? `<p><em>Overridden to <strong>${esc(latestScore.overriddenRating)}</strong> (original: ${esc(latestScore.riskRating)})</em></p>` : ''}
` : '<p class="section-empty">No score run recorded.</p>'}

<!-- ═══════════ S5 — Bureau & Compliance ═══════════ -->
<h2>S5 — Bureau &amp; Compliance</h2>
<h3>Credit Bureau Checks</h3>
${(app.bureauChecks ?? []).length > 0 ? `<table>
  <tr><th>Provider</th><th>Subject</th><th>Run Date</th><th>Hits</th><th>Findings</th></tr>
  ${app.bureauChecks.map((c: any) => `<tr><td>${esc(c.provider)}</td><td>${esc(c.subjectName)}</td><td>${fmtDate(c.runDate)}</td><td class="${c.hasHits === true ? 'hit-yes' : c.hasHits === false ? 'hit-no' : ''}">${c.hasHits === true ? 'YES' : c.hasHits === false ? 'No' : '—'}</td><td>${esc(c.findings)}</td></tr>`).join('')}
</table>` : '<p class="section-empty">No bureau checks recorded.</p>'}

<h3>Industry Outlook</h3>
${app.industryAssessment ? `<table>
  <tr><td class="label">Sector</td><td>${esc(app.industryAssessment.sectorName)}</td><td class="label">Sub-sector</td><td>${esc(app.industryAssessment.subsectorName)}</td></tr>
  <tr><td class="label">Sector Outlook</td><td colspan="3">${esc(app.industryAssessment.sectorOutlook)}</td></tr>
  <tr><td class="label">Sub-sector Outlook</td><td colspan="3">${esc(app.industryAssessment.subsectorOutlook)}</td></tr>
</table>` : '<p class="section-empty">No industry outlook recorded.</p>'}

<h3>Risk &amp; Mitigators</h3>
${(app.riskAssessments ?? []).length > 0 ? `<table>
  <tr><th>Risk Category</th><th>Description</th><th>Mitigation</th></tr>
  ${app.riskAssessments.map((r: any) => `<tr><td>${esc(r.riskCategory)}</td><td>${esc(r.description)}</td><td>${esc(r.mitigation)}</td></tr>`).join('')}
</table>` : '<p class="section-empty">No risk assessments recorded.</p>'}

<h3>ESG Assessment</h3>
${app.esgAssessment ? `<table>
  <tr><td class="label">Guiding Principle</td><td>${esc(app.esgAssessment.assignedGp)}</td><td class="label">ESG Category</td><td>${esc(app.esgAssessment.assignedCategory)}</td></tr>
  <tr><td class="label">Justification</td><td colspan="3">${esc(app.esgAssessment.justification)}</td></tr>
</table>` : '<p class="section-empty">No ESG assessment recorded.</p>'}

<h3>SICR Assessment</h3>
${(app.sicrAssessments ?? []).length > 0 ? `<table>
  <tr><th>Trigger Type</th><th>Has Hit</th><th>Triggering Event</th><th>Rationale</th><th>Classification</th></tr>
  ${app.sicrAssessments.map((s: any) => `<tr><td>${esc(s.triggerType)}</td><td class="${s.hasHit === true ? 'hit-yes' : s.hasHit === false ? 'hit-no' : ''}">${s.hasHit === true ? 'YES' : s.hasHit === false ? 'No' : '—'}</td><td>${esc(s.triggeringEvent)}</td><td>${esc(s.rationale)}</td><td>${esc(s.resultingClassification)}</td></tr>`).join('')}
</table>` : '<p class="section-empty">No SICR assessments recorded.</p>'}

<!-- ═══════════ S6 — Collateral & Guarantees ═══════════ -->
<h2>S6 — Collateral &amp; Guarantees</h2>
${(app.facilities ?? []).some((f: any) => (f.collaterals ?? []).length > 0) ? `
<h3>Collateral</h3>
<table>
  <tr><th>Facility</th><th>Type</th><th>Description</th><th>Market Value</th><th>Forced Sale</th><th>Valuation Date</th><th>Security Cat.</th></tr>
  ${(app.facilities ?? []).flatMap((f: any) => (f.collaterals ?? []).map((c: any) => ({ ...c, facilityType: f.facilityType }))).map((c: any) => `<tr><td>${esc(c.facilityType)}</td><td>${esc(c.collateralType)}</td><td>${esc(c.description)}</td><td class="right">${fmt(c.marketValue)}</td><td class="right">${fmt(c.forcedSaleValue)}</td><td>${fmtDate(c.valuationDate)}</td><td>${esc(c.securityCategory)}</td></tr>`).join('')}
</table>` : '<p class="section-empty">No collateral recorded.</p>'}

${(app.facilities ?? []).some((f: any) => (f.guarantees ?? []).length > 0) ? `
<h3>Guarantees</h3>
<table>
  <tr><th>Facility</th><th>Guarantor</th><th>Type</th><th>Amount</th><th>Limited</th><th>Net Worth</th><th>Remarks</th></tr>
  ${(app.facilities ?? []).flatMap((f: any) => (f.guarantees ?? []).map((g: any) => ({ ...g, facilityType: f.facilityType }))).map((g: any) => {
    const name = g.guarantorProfile?.name ?? '—';
    return `<tr><td>${esc(g.facilityType)}</td><td>${esc(name)}</td><td>${esc(g.guaranteeType)}</td><td class="right">${fmt(g.amount)}</td><td>${g.isLimited ? 'Yes' : 'No'}</td><td class="right">${fmt(g.estimatedNetWorth)}</td><td>${esc(g.remarks)}</td></tr>`;
  }).join('')}
</table>` : ''}

<!-- ═══════════ S6 (cont.) — Way Out ═══════════ -->
<h2>Way Out</h2>
<table>
  <tr><td class="label">First Way Out</td><td>${esc(app.firstWayOut)}</td></tr>
  <tr><td class="label">Second Way Out</td><td>${esc(app.secondWayOut)}</td></tr>
  <tr><td class="label">Other Way Out</td><td>${esc(app.otherWayOut)}</td></tr>
</table>

<!-- ═══════════ S7 — Decision ═══════════ -->
<h2>S7 — Decision</h2>
<h3>Account Strategy &amp; Cross-Selling</h3>
<table>
  <tr><td class="label">Account Strategy</td><td><span class="badge badge-${(app.accountStrategy ?? '').toLowerCase()}">${esc(strategyLabel)}</span></td></tr>
  <tr><td class="label">Cross-Selling Initiatives</td><td>${esc(app.crossSellingInitiatives)}</td></tr>
</table>

${(app.decisions ?? []).length > 0 ? `<h3>Approval Decisions</h3>
<table>
  <tr><th>Decision</th><th>Decided By</th><th>Date</th><th>Authority</th><th>Comments</th></tr>
  ${app.decisions.map((d: any) => `<tr><td>${esc(d.decisionType)}</td><td>${esc(d.decidedBy?.firstName)} ${esc(d.decidedBy?.lastName)}</td><td>${fmtDate(d.decisionAt)}</td><td>${esc(d.authorityLevel)}</td><td>${esc(d.comments)}</td></tr>`).join('')}
</table>` : ''}

<h3>Sign-off</h3>
<table>
  <tr><th>Prepared By</th><th>Reviewed By</th><th>Concurred By</th></tr>
  <tr>${sigRow('Prepared By', prepared)}${sigRow('Reviewed By', reviewed)}${sigRow('Concurred By', concurred)}</tr>
</table>

${(app.conditions ?? []).length > 0 ? `<h3>Conditions Precedent</h3>
<table>
  <tr><th>Title</th><th>Category</th><th>Type</th><th>Status</th><th>Due Date</th><th>Notes</th></tr>
  ${app.conditions.map((c: any) => {
    const statusLabel = c.status === 'FULFILLED' ? '✓ Fulfilled' : c.status === 'WAIVED' ? '⊘ Waived' : esc(c.status);
    const statusClass = c.status === 'FULFILLED' ? 'hit-no' : c.status === 'WAIVED' ? 'hit-yes' : '';
    return `<tr><td>${esc(c.title)}</td><td>${esc(c.category)}</td><td>${esc(c.conditionType)}</td><td class="${statusClass}">${statusLabel}</td><td>${fmtDate(c.dueDate)}</td><td>${esc(c.fulfilmentNotes ?? c.waiverReason)}</td></tr>`;
  }).join('')}
</table>` : ''}

</body>
</html>`;
}

export async function previewCaMemo(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = String(req.params.appId);

    // P2.2d — If a locked memo version exists, show the locked HTML snapshot
    // instead of regenerating from live data.
    const lockedVersion = await getLockedMemoVersion(appId);

    if (lockedVersion) {
      res.type('html').send(lockedVersion.htmlContent);
      return;
    }

    // No locked version — generate from live data
    const app = await getCaMemoData(appId);
    const title = `CA Memo — ${app.applicationNo}`;
    const html = buildHtml(app, title);
    res.type('html').send(html);
  } catch (e) { next(e); }
}

export async function generateCaMemo(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = String(req.params.appId);
    const userId = (req as any).user?.id;

    // P2.2b — Save a versioned snapshot when generating the memo PDF.
    // If the latest version is locked, this will throw a 409.
    const memoVersion = await generateAndSaveMemoVersion(appId, userId);

    // If PDF URL was set (async job), include it in the response
    res.json({
      status: 'success',
      data: {
        memoVersionId: memoVersion.id,
        versionNumber: memoVersion.versionNumber,
        isLocked: memoVersion.isLocked,
        message: memoVersion.isLocked
          ? 'Memo version is locked. PDF generation uses the locked snapshot.'
          : 'Memo version saved. PDF generation started.',
      },
    });
  } catch (e) { next(e); }
}