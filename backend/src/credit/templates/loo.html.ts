/**
 * LOO (Letter of Offer) HTML template.
 *
 * Merge fields are rendered using a simple {{field}} syntax.
 * The caller injects values via string replacement before passing to htmlToPdf().
 */
export interface LooTemplateData {
  applicationNo: string;
  date: string;
  lenderName: string;
  lenderAddress: string;
  borrowerName: string;
  borrowerAddress: string;
  facilities: {
    facilityType: string;
    approvedAmount: string;
    tenor: string;
    effectiveRate: string;
    repaymentSchedule: string;
  }[];
  conditionsPrecedent: string[];
  conditionsSubsequent: string[];
  expiryDate: string;
  expiryDays: number;
  version: number;
}

export function renderLooHtml(data: LooTemplateData): string {
  const facilityRows = data.facilities
    .map(
      (f) => `
      <tr>
        <td style="border:1px solid #333;padding:6px 10px;">${f.facilityType}</td>
        <td style="border:1px solid #333;padding:6px 10px;text-align:right;">${f.approvedAmount}</td>
        <td style="border:1px solid #333;padding:6px 10px;text-align:center;">${f.tenor}</td>
        <td style="border:1px solid #333;padding:6px 10px;text-align:center;">${f.effectiveRate}</td>
        <td style="border:1px solid #333;padding:6px 10px;">${f.repaymentSchedule}</td>
      </tr>`,
    )
    .join('\n');

  const cpList =
    data.conditionsPrecedent.length > 0
      ? data.conditionsPrecedent.map((c) => `<li>${escapeHtml(c)}</li>`).join('\n')
 : '<li>As per credit approval</li>';

 const csList =
 data.conditionsSubsequent.length > 0
 ? data.conditionsSubsequent.map((c) => `<li>${escapeHtml(c)}</li>`).join('\n')
      : '<li>None</li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 11pt; color: #222; margin: 0; padding: 0; }
  .letterhead { text-align: center; border-bottom: 2px solid #1a3c6e; padding-bottom: 12px; margin-bottom: 24px; }
  .letterhead h1 { font-size: 14pt; color: #1a3c6e; margin: 0; }
  .letterhead p { font-size: 9pt; color: #555; margin: 2px 0; }
  .section { margin-bottom: 18px; }
  .section h2 { font-size: 11pt; color: #1a3c6e; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
  table.facilities { width: 100%; border-collapse: collapse; margin: 8px 0; }
  table.facilities th { background-color: #1a3c6e; color: white; padding: 6px 10px; text-align: left; font-size: 9pt; }
  .conditions ul { margin: 4px 0; padding-left: 20px; }
  .conditions li { font-size: 10pt; margin-bottom: 3px; }
  .signature-block { margin-top: 36px; }
  .signature-line { display: inline-block; width: 45%; vertical-align: top; }
  .signature-line .line { border-top: 1px solid #333; margin-top: 50px; padding-top: 4px; font-size: 9pt; }
  .footer { margin-top: 40px; font-size: 8pt; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
  .version-badge { font-size: 8pt; color: #888; float: right; }
  .expiry-notice { background-color: #fff3cd; border: 1px solid #ffc107; padding: 8px 12px; margin: 12px 0; border-radius: 4px; font-size: 10pt; }
</style>
</head>
<body>
  <div class="letterhead">
    <h1>${escapeHtml(data.lenderName)}</h1>
    <p>${escapeHtml(data.lenderAddress)}</p>
    <p>Date: ${escapeHtml(data.date)}</p>
  </div>

  <div class="section">
    <p><strong>Borrower:</strong> ${escapeHtml(data.borrowerName)}</p>
    <p>${escapeHtml(data.borrowerAddress)}</p>
  </div>

  <div class="section">
    <h2>Subject: Letter of Offer — ${escapeHtml(data.applicationNo)} <span class="version-badge">Version ${data.version}</span></h2>
    <p>Dear ${escapeHtml(data.borrowerName)},</p>
    <p>We are pleased to offer you the following credit facility/facilities, subject to the terms and conditions herein:</p>
  </div>

  <div class="section">
    <h2>Facility Details</h2>
    <table class="facilities">
      <thead>
        <tr>
          <th>Facility Type</th>
          <th style="text-align:right;">Approved Amount (MYR)</th>
          <th style="text-align:center;">Tenor</th>
          <th style="text-align:center;">Effective Rate (%)</th>
          <th>Repayment</th>
        </tr>
      </thead>
      <tbody>
        ${facilityRows}
      </tbody>
    </table>
  </div>

  <div class="section conditions">
    <h2>Conditions Precedent</h2>
    <ul>${cpList}</ul>
  </div>

  <div class="section conditions">
    <h2>Conditions Subsequent</h2>
    <ul>${csList}</ul>
  </div>

  <div class="expiry-notice">
    <strong>Validity:</strong> This Letter of Offer is valid until <strong>${escapeHtml(data.expiryDate)}</strong> (${data.expiryDays} days from the date of issuance). 
    The offer shall lapse automatically after the expiry date unless accepted in writing prior to that date.
  </div>

  <div class="signature-block">
    <div class="signature-line">
      <p><strong>Borrower's Acceptance</strong></p>
      <div class="line">
        Signature: ________________________<br/>
        Name: ${escapeHtml(data.borrowerName)}<br/>
        NRIC/Passport: ________________________<br/>
        Date: ________________________
      </div>
    </div>
    <div class="signature-line">
      <p><strong>For ${escapeHtml(data.lenderName)}</strong></p>
      <div class="line">
        Signature: ________________________<br/>
        Name: ________________________<br/>
        Designation: ________________________<br/>
        Date: ________________________
      </div>
    </div>
  </div>

  <p style="font-size:9pt; margin-top:24px;">Witness 1: ________________________ &nbsp; Name: ________________________ &nbsp; Date: ______________</p>
  <p style="font-size:9pt;">Witness 2: ________________________ &nbsp; Name: ________________________ &nbsp; Date: ______________</p>

  <div class="footer">
    This is a system-generated Letter of Offer for application ${escapeHtml(data.applicationNo)}. Version ${data.version}.<br/>
    ${escapeHtml(data.lenderName)} — Confidential
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}