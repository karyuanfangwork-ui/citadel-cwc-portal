/**
 * CWC Credit Module — E2E Smoke Test (Sprint 6)
 *
 * Full lifecycle: borrower → application → spreading → scoring → committee → approval → drawdown → monitoring
 *
 * Usage: npx tsx scripts/creditSmokeTest.ts
 */

import * as http from 'http';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_PREFIX = '/api/v1/auth';
const API_PREFIX = '/api/v1/credit';
const CRM_PREFIX = '/api/v1/crm';

let authToken = '';
let adminUserId = '';

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
function request(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode || 0, data: parsed });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Like request() but accepts an explicit token override instead of the global authToken.
 */
function apiRequest(method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const bearerToken = token ?? authToken;
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode || 0, data: parsed });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function v(obj: any, path: string): any {
  for (const k of path.split('.')) { if (obj == null) return null; obj = obj[k]; }
  return obj;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

/**
 * Assert that a response has a specific HTTP status code.
 */
function assertStatus(resp: { status: number; data: any }, expectedStatus: number, label: string) {
  check(label, resp.status === expectedStatus, `expected ${expectedStatus}, got ${resp.status}`);
}

/**
 * Assert that a response body field (dot-path on resp.data) exists and matches
 * the expected JS typeof type string (e.g. 'string', 'number', 'object').
 */
function assertField(
  resp: { status: number; data: any },
  dotPath: string,
  expectedType: string,
  message?: string,
) {
  const value = v(resp.data, dotPath);
  const label = message ?? `${dotPath} should be a ${expectedType}`;
  check(label, value !== null && value !== undefined && typeof value === expectedType, `got ${JSON.stringify(value)}`);
}

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------
let accountId = '';
let borrowerId = '';
let applicationId = '';
let meetingId = '';
let memberId = '';
let agendaItemId = '';
let conditionId = '';
let facilityId = '';
let collateralId = '';
let covenantId = '';
let statementId = '';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
async function main() {
  console.log('🧪 CWC Credit Module — E2E Smoke Test\n');

  // ---------------------------------------------------------------
  // Phase 1: Origination
  // ---------------------------------------------------------------
  console.log('--- Phase 1: Origination ---');

  // Step 1: Login
  let r = await request('POST', `${AUTH_PREFIX}/login`, {
    email: 'admin@test.local',
    password: 'abc@123',
  });
  authToken = v(r.data, 'data.accessToken') || '';
  check('Step 1: Login', !!authToken);

  // Get admin user ID for committee member
  r = await request('GET', `/api/v1/users?limit=1`);
  adminUserId = v(r.data, 'data.users.0.id') || v(r.data, 'data.0.id') || '';

  // Step 2: Create CRM Account + Borrower Profile
  r = await request('POST', `${CRM_PREFIX}/accounts`, {
    name: 'SmokeTest Corp Sdn Bhd',
    accountType: 'CORPORATE',
    industry: 'Technology',
  });
  accountId = v(r.data, 'data.account.id') || '';
  check('Step 2a: Create CRM account', !!accountId);

  r = await request('POST', `${API_PREFIX}/borrowers`, {
    accountId,
    borrowerType: 'CORPORATE',
    legalName: 'SmokeTest Corp Sdn Bhd',
  });
  borrowerId = v(r.data, 'data.profile.id') || '';
  check('Step 2b: Create borrower profile', !!borrowerId);
  // Shape assertions: verify the response body has expected fields
  assertField(r, 'data.profile.id', 'string', 'borrower profile.id should be a string');
  assertField(r, 'data.profile.legalName', 'string', 'borrower profile.legalName should be a string');

  // Step 3: Create Credit Application
  r = await request('POST', `${API_PREFIX}/applications`, {
    borrowerProfileId: borrowerId,
    productType: 'TERM_LOAN',
    requestedAmount: 5000000,
    requestedTenor: 60,
    currency: 'MYR',
    purpose: 'E2E smoke test — term loan RM5M',
  });
  applicationId = v(r.data, 'data.application.id') || '';
  check('Step 3: Create application', !!applicationId);
  // Shape assertions: verify application response body
  assertField(r, 'data.application.id', 'string', 'application.id should be a string');
  assertField(r, 'data.application.state', 'string', 'application.state should be a string');
  assertField(r, 'data.application.requestedAmount', 'number', 'application.requestedAmount should be a number');

  // ---------------------------------------------------------------
  // Phase 2: KYC & Underwriting
  // ---------------------------------------------------------------
  console.log('\n--- Phase 2: KYC & Underwriting ---');

  // Step 4: Transition DRAFT → SUBMITTED
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'submit' });
  check('Step 4: DRAFT → SUBMITTED', r.status === 200, `status=${r.status}`);

  // Step 5: Transition SUBMITTED → KYC_REVIEW
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'start_kyc' });
  check('Step 5: SUBMITTED → KYC_REVIEW', r.status === 200, `status=${r.status}`);

  // Step 6: Transition KYC_REVIEW → KYC_APPROVED
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'approve_kyc' });
  check('Step 6: KYC_REVIEW → KYC_APPROVED', r.status === 200, `status=${r.status}`);

  // Step 7: Transition KYC_APPROVED → UNDERWRITING
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'start_underwriting' });
  check('Step 7: KYC_APPROVED → UNDERWRITING', r.status === 200, `status=${r.status}`);

  // Step 8: Transition UNDERWRITING → CREDIT_ASSESSMENT
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'start_assessment' });
  check('Step 8: UNDERWRITING → CREDIT_ASSESSMENT', r.status === 200, `status=${r.status}`);

  // ---------------------------------------------------------------
  // Phase 3: Financial Spreading & Scoring
  // ---------------------------------------------------------------
  console.log('\n--- Phase 3: Financial Spreading & Scoring ---');

  // Step 9: Create financial statement (then add line items)
  r = await request('POST', `${API_PREFIX}/borrowers/${borrowerId}/financials`, {
    period: 'ANNUAL',
    fiscalYearEnd: '2025-12-31',
    statementType: 'BS',
    currency: 'MYR',
  });
  statementId = v(r.data, 'data.statement.id') || v(r.data, 'data.id') || '';
  check('Step 9a: Create financial statement (BS)', !!statementId, `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 200)}`);

  // Step 9b: Add line items to the statement
  if (statementId) {
    r = await request('POST', `${API_PREFIX}/financials/${statementId}/line-items`, {
      items: [
        { lineKey: 'cash', lineLabel: 'Cash & Equivalents', amount: 1500000, displayOrder: 1 },
        { lineKey: 'receivables', lineLabel: 'Accounts Receivable', amount: 800000, displayOrder: 2 },
        { lineKey: 'inventory', lineLabel: 'Inventory', amount: 600000, displayOrder: 3 },
        { lineKey: 'assets', lineLabel: 'Total Assets', amount: 5000000, displayOrder: 4 },
        { lineKey: 'liabilities', lineLabel: 'Total Liabilities', amount: 2000000, displayOrder: 5 },
        { lineKey: 'equity', lineLabel: 'Equity', amount: 3000000, displayOrder: 6 },
      ],
    });
    check('Step 9b: Add line items', r.status === 200 || r.status === 201, `status=${r.status}`);
  } else {
    check('Step 9b: Add line items', false, 'no statement ID');
  }

  // Step 10: Credit Scoring
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/score`, {});
  check('Step 10: Run credit scoring', r.status === 200 || r.status === 201, `status=${r.status}`);

  // ---------------------------------------------------------------
  // Phase 4: Committee Review
  // ---------------------------------------------------------------
  console.log('\n--- Phase 4: Committee Review ---');

  // Step 11: Transition → COMMITTEE_REVIEW
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'submit_to_committee' });
  check('Step 11: CREDIT_ASSESSMENT → COMMITTEE_REVIEW', r.status === 200, `status=${r.status}`);

  // Step 12: Schedule Committee Meeting
  r = await request('POST', `${API_PREFIX}/committee/meetings`, {
    title: 'E2E Smoke Test Committee',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    meetingType: 'REGULAR',
    quorumMin: 1,
  });
  meetingId = v(r.data, 'data.meeting.id') || '';
  check('Step 12: Schedule committee meeting', !!meetingId, `status=${r.status}`);

  // Step 13: Add committee member (needs userId + role CHAIR/MEMBER/SECRETARY)
  if (meetingId && adminUserId) {
    r = await request('POST', `${API_PREFIX}/committee/meetings/${meetingId}/members`, {
      userId: adminUserId,
      role: 'CHAIR',
    });
    memberId = v(r.data, 'data.member.id') || '';
    check('Step 13: Add committee member', !!memberId, `status=${r.status}, userId=${adminUserId}`);
  } else {
    check('Step 13: Add committee member', false, 'missing meetingId or adminUserId');
  }

  // Step 13b: Mark member as PRESENT (required for quorum before finalizing)
  if (adminUserId && meetingId) {
    r = await request('PATCH', `${API_PREFIX}/committee/meetings/${meetingId}/members/${adminUserId}/attendance`, {
      attendance: 'PRESENT',
    });
    check('Step 13b: Mark member attendance PRESENT', r.status === 200, `status=${r.status}`);
  } else {
    check('Step 13b: Mark member attendance PRESENT', false, 'no memberId');
  }

  // Step 14: Add agenda item (needs displayOrder, no title field)
  if (meetingId) {
    r = await request('POST', `${API_PREFIX}/committee/meetings/${meetingId}/agenda`, {
      applicationId,
      displayOrder: 1,
      decisionType: 'APPROVE',
    });
    agendaItemId = v(r.data, 'data.item.id') || '';
    check('Step 14: Add agenda item', !!agendaItemId, `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 200)}`);
  } else {
    check('Step 14: Add agenda item', false, 'missing meetingId');
  }

  // Step 15: Cast APPROVE vote (needs memberId not agendaItemId)
  if (agendaItemId && memberId) {
    r = await request('POST', `${API_PREFIX}/committee/agenda/${agendaItemId}/vote`, {
      memberId,
      vote: 'APPROVE',
      comments: 'E2E smoke test — approve',
    });
    check('Step 15: Cast APPROVE vote', r.status === 200 || r.status === 201, `status=${r.status}`);
  } else {
    check('Step 15: Cast APPROVE vote', false, `missing agendaItemId=${agendaItemId} or memberId=${memberId}`);
  }

  // Step 16: Finalize decision (at /committee/agenda/:itemId/finalize, not /meetings/:id/finalize)
  if (agendaItemId) {
    r = await request('POST', `${API_PREFIX}/committee/agenda/${agendaItemId}/finalize`, {
      decision: 'APPROVED',
    });
    check('Step 16: Finalize committee decision', r.status === 200, `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 200)}`);
  } else {
    check('Step 16: Finalize committee decision', false, 'missing agendaItemId');
  }

  // Step 17: Transition COMMITTEE_REVIEW → APPROVED
  // First verify current state
  r = await request('GET', `${API_PREFIX}/applications/${applicationId}`);
  const currentState = v(r.data, 'data.application.state') || '';
  if (currentState === 'COMMITTEE_REVIEW') {
    r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'approve' });
    check('Step 17: COMMITTEE_REVIEW → APPROVED', r.status === 200, `status=${r.status}`);
  } else {
    // Already past committee review (e.g. finalize auto-transitioned)
    check('Step 17: COMMITTEE_REVIEW → APPROVED (already past)', 
      ['APPROVED', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE'].includes(currentState), 
      `current=${currentState}`);
  }

  // ---------------------------------------------------------------
  // Phase 5: Post-Approval
  // ---------------------------------------------------------------
  console.log('\n--- Phase 5: Post-Approval ---');

  // Step 18: Add conditions precedent
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/conditions`, {
    conditionType: 'PRECEDENT',
    description: 'Submit board resolution authorizing borrowing',
    dueDate: '2026-06-30',
  });
  conditionId = v(r.data, 'data.condition.id') || v(r.data, 'data.id') || '';
  check('Step 18: Add CP condition', !!conditionId, `status=${r.status}`);

  // Step 19: Complete condition
  if (conditionId) {
    r = await request('POST', `${API_PREFIX}/conditions/${conditionId}/complete`, { notes: 'Board resolution received' });
    check('Step 19: Complete condition', r.status === 200, `status=${r.status}`);
  } else {
    check('Step 19: Complete condition', false, 'no condition ID');
  }

  // Step 20: Verify application state
  r = await request('GET', `${API_PREFIX}/applications/${applicationId}`);
  const appState = v(r.data, 'data.application.state') || v(r.data, 'data.state') || '';
  check('Step 20: Verify application state is APPROVED', appState === 'APPROVED', `state=${appState}`);

  // Step 21: Add collateral
  r = await request('GET', `${API_PREFIX}/applications/${applicationId}/facilities`);
  facilityId = v(r.data, 'data.facilities.0.id') || v(r.data, 'data.0.id') || '';

  if (!facilityId) {
    r = await request('POST', `${API_PREFIX}/applications/${applicationId}/facilities`, {
      facilityType: 'TERM_LOAN',
      amount: 5000000,
      currency: 'MYR',
    });
    facilityId = v(r.data, 'data.facility.id') || v(r.data, 'data.id') || '';
  }

  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/collateral`, {
    facilityId,
    collateralType: 'PROPERTY',
    description: 'Commercial property — SmokeTest Building',
    estimatedValue: 8000000,
  });
  collateralId = v(r.data, 'data.collateral.id') || v(r.data, 'data.id') || '';
  check('Step 21: Add collateral', !!collateralId, `status=${r.status}`);

  // Step 22: Add valuation to collateral
  if (collateralId) {
    r = await request('POST', `${API_PREFIX}/collateral/${collateralId}/valuations`, {
      valuer: 'JLL Valuations',
      valuationDate: '2026-04-01',
      marketValue: 8000000,
      forcedSaleValue: 6000000,
      reportReference: 'JLW-SMOKE-001',
    });
    check('Step 22: Add valuation', r.status === 200 || r.status === 201, `status=${r.status}`);
  } else {
    check('Step 22: Add valuation', false, 'no collateral ID');
  }

  // Step 23: Transition APPROVED → OFFER → ACCEPTED → DISBURSED
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'make_offer' });
  const offerOk = r.status === 200;
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'accept_offer' });
  const acceptOk = r.status === 200;
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/transition`, { action: 'disburse' });
  check('Step 23: Transition to DISBURSED', r.status === 200, `offer=${offerOk} accept=${acceptOk} disburse_status=${r.status}`);

  // ---------------------------------------------------------------
  // Phase 6: Monitoring
  // ---------------------------------------------------------------
  console.log('\n--- Phase 6: Monitoring ---');

  // Step 24: Create facility health
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/health`, {
    healthStatus: 'HEALTHY',
    nextReviewDate: '2026-09-30',
    reviewFrequency: 'QUARTERLY',
  });
  check('Step 24: Create facility health', r.status === 200 || r.status === 201, `status=${r.status}`);

  // Step 25: Create covenant
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/covenants`, {
    description: 'DSCR > 1.25x',
    covenantType: 'DEBT_SERVICE_COVERAGE',
    metricKey: 'DSCR',
    threshold: '1.25',
    frequency: 'QUARTERLY',
  });
  covenantId = v(r.data, 'data.covenant.id') || '';
  check('Step 25: Create covenant', !!covenantId, `status=${r.status}`);

  // Step 26: Create payment event
  r = await request('POST', `${API_PREFIX}/applications/${applicationId}/payments`, {
    dueDate: '2026-06-30',
    amount: 125000,
    status: 'ON_TIME',
  });
  check('Step 26: Create payment event', r.status === 200 || r.status === 201, `status=${r.status}`);

  // Step 27: Verify monitoring data exists
  r = await request('GET', `${API_PREFIX}/applications/${applicationId}/health`);
  check('Step 27a: Facility health exists', r.status === 200, `status=${r.status}`);

  r = await request('GET', `${API_PREFIX}/applications/${applicationId}/covenants`);
  check('Step 27b: Covenants listed', r.status === 200, `status=${r.status}`);

  r = await request('GET', `${API_PREFIX}/applications/${applicationId}/payments`);
  check('Step 27c: Payments listed', r.status === 200, `status=${r.status}`);

  // ---------------------------------------------------------------
  // Phase 7: Dashboards
  // ---------------------------------------------------------------
  console.log('\n--- Phase 7: Dashboards ---');

  r = await request('GET', `${API_PREFIX}/dashboard/pipeline`);
  check('Step 28a: Pipeline dashboard', r.status === 200, `status=${r.status}`);

  r = await request('GET', `${API_PREFIX}/dashboard/exposure`);
  check('Step 28b: Exposure dashboard', r.status === 200, `status=${r.status}`);

  r = await request('GET', `${API_PREFIX}/dashboard/approval-inbox`);
  check('Step 28c: Approval inbox dashboard', r.status === 200, `status=${r.status}`);

  r = await request('GET', `${API_PREFIX}/dashboard/committee-calendar`);
  check('Step 28d: Committee calendar dashboard', r.status === 200, `status=${r.status}`);

  // ---------------------------------------------------------------
  // Phase 8: Security / SoD / Export Token Tests
  // ---------------------------------------------------------------
  console.log('\n--- Phase 8: Security & SoD Checks ---');

  // ---------------------------------------------------------------
  // Section A: SoD violation — a non-approver user cannot call the
  // approval endpoint.  We log in as hr@test.local (no credit:approve
  // permission) and attempt to approve the application created above.
  // The expected result is 403 from the permission check.
  //
  // NOTE: To test the SoD maker-checker rule specifically (assignedRmId
  // === actorId → 403), seed a user with CREDIT_RM role, assign them
  // as the RM on an application, then attempt self-approval with their
  // token.  The current seed does not include a standalone CREDIT_RM
  // user, so the permission-layer 403 is tested here as a proxy.
  // ---------------------------------------------------------------
  let rmToken = '';
  {
    const loginResp = await apiRequest('POST', `${AUTH_PREFIX}/login`, {
      email: 'hr@test.local',
      password: 'abc@123',
    });
    rmToken = v(loginResp.data, 'data.accessToken') || '';
    check('Step 29a: Login as non-approver user (hr)', !!rmToken, `status=${loginResp.status}`);
  }

  if (rmToken && applicationId) {
    // Attempt to approve the application as a user without credit:approve permission.
    // SoD middleware sits behind requirePermission('credit:approve'), so the 403
    // originates from the permission check (the first gate).
    const sodResp = await apiRequest(
      'POST',
      `${API_PREFIX}/applications/${applicationId}/approvals`,
      { decision: 'APPROVE', comment: 'Self-approval attempt' },
      rmToken,
    );
    assertStatus(sodResp, 403, 'Step 29b: Non-approver cannot submit approval (403 expected)');
    check('Step 29b: SoD/permission guard correctly rejected request', sodResp.status === 403, `got status=${sodResp.status}`);
  } else {
    check('Step 29b: SoD test (skipped — no rmToken or applicationId)', false, 'prerequisite missing');
  }

  // ---------------------------------------------------------------
  // Section B: Export token lifecycle
  // Admin has credit:export permission, so this tests the full flow:
  //   1. Request an export → expect token in response
  //   2. Verify an invalid/fabricated token is rejected
  // ---------------------------------------------------------------
  let exportToken = '';
  if (applicationId) {
    const exportResp = await apiRequest(
      'POST',
      `${API_PREFIX}/security/export`,
      {
        resourceType: 'CreditApplication',
        resourceId: applicationId,
        format: 'JSON',
        reason: 'Smoke test export lifecycle verification',
      },
      authToken,
    );
    check('Step 30a: Export request accepted (200)', exportResp.status === 200, `status=${exportResp.status}`);
    exportToken = v(exportResp.data, 'data.token') || '';
    check('Step 30b: Export response contains token', !!exportToken, `token=${exportToken}`);
    assertField(exportResp, 'data.token', 'string', 'export token should be a string');
    assertField(exportResp, 'data.expiresAt', 'string', 'export expiresAt should be a string');
  } else {
    check('Step 30a: Export request (skipped — no applicationId)', false, 'prerequisite missing');
    check('Step 30b: Export token present (skipped)', false, 'prerequisite missing');
  }

  // Verify an invalid (fabricated) token is rejected.
  // The verifyExportToken endpoint is internal, so we test by re-requesting
  // an export with a tampered/bogus token header — any endpoint protected
  // by export-token verification should refuse it.  Here we call the export
  // endpoint itself with a fake Bearer token to confirm auth is enforced.
  {
    const fakeToken = 'INVALID_EXPORT_TOKEN_' + Math.random().toString(36).slice(2);
    const invalidResp = await apiRequest(
      'POST',
      `${API_PREFIX}/security/export`,
      {
        resourceType: 'CreditApplication',
        resourceId: applicationId || 'nonexistent-id',
        format: 'JSON',
        reason: 'Invalid token test',
      },
      fakeToken,
    );
    check(
      'Step 30c: Invalid bearer token is rejected (401)',
      invalidResp.status === 401,
      `status=${invalidResp.status}`,
    );
  }

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log('\n' + '='.repeat(50));
  console.log(`PASSED: ${passed}   FAILED: ${failed}   TOTAL: ${passed + failed}`);
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });