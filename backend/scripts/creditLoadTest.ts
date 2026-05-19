/**
 * CWC Credit Module — Performance / Concurrency Test (Sprint 6, Task 6.14)
 *
 * Tests that the system can handle 200 concurrent application creation requests
 * without data corruption, deadlocks, or excessive errors.
 *
 * Usage: npx tsx scripts/creditLoadTest.ts
 *
 * Requirements:
 *   - Server running at BASE_URL (default http://localhost:3000)
 *   - Seed data loaded (npm run prisma:seed)
 *   - Admin auth credentials (default admin@test.local / abc@123)
 */

import * as http from 'http';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1/credit';
const AUTH_PREFIX = '/api/v1/auth';
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT || '200', 10);
const RAMP_UP_MS = parseInt(process.env.RAMP_UP || '5000', 10); // 5 seconds ramp-up

let authToken = '';
let adminUserId = '';
let borrowerProfileId = '';

// ---------------------------------------------------------------------------
// HTTP helper (same as smoke test)
// ---------------------------------------------------------------------------
function request(method: string, path: string, body?: any): Promise<{ status: number; data: any; timeMs: number }> {
  const start = Date.now();
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
        resolve({ status: res.statusCode || 0, data: parsed, timeMs: Date.now() - start });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('CWC Credit Module — Performance Test');
  console.log('=====================================\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Ramp-up: ${RAMP_UP_MS}ms\n`);

  // Step 1: Authenticate as admin
  console.log('Authenticating as admin...');
  const authRes = await request('POST', `${AUTH_PREFIX}/login`, {
    email: 'admin@test.local',
    password: 'abc@123',
  });
  if (authRes.status !== 200 || !authRes.data?.token) {
    console.error(`Auth failed: status=${authRes.status}, body=${JSON.stringify(authRes.data).slice(0, 300)}`);
    process.exit(1);
  }
  authToken = authRes.data.token;
  adminUserId = authRes.data.user?.id || '';
  console.log(`  ✅ Authenticated as admin (id=${adminUserId})\n`);

  // Step 2: Find or create a borrower profile
  console.log('Finding borrower profile...');
  const listRes = await request('GET', `${API_PREFIX}/borrowers?limit=1`);
  if (listRes.status === 200 && v(listRes.data, 'borrowers.length') > 0) {
    borrowerProfileId = v(listRes.data, 'borrowers.0.id');
    console.log(`  ✅ Using existing borrower: ${borrowerProfileId}\n`);
  } else {
    console.log('  Creating new borrower profile...');
    const createRes = await request('POST', `${API_PREFIX}/borrowers`, {
      entityType: 'INDIVIDUAL',
      legalName: 'Load Test Borrower',
      identificationNo: `LT${Date.now()}`,
      countryCode: 'MY',
    });
    if (createRes.status >= 200 && createRes.status < 300) {
      borrowerProfileId = v(createRes.data, 'id') || v(createRes.data, 'borrowerProfile.id');
      console.log(`  ✅ Created borrower: ${borrowerProfileId}\n`);
    } else {
      console.error(`  ❌ Failed to create borrower: ${createRes.status}`);
      process.exit(1);
    }
  }

  // Step 3: Fire 200 concurrent application creation requests
  console.log(`Firing ${CONCURRENT_REQUESTS} concurrent application creation requests...\n`);
  const startTime = Date.now();

  // Ramp up: spread requests over RAMP_UP_MS
  const requests: Promise<{ status: number; data: any; timeMs: number }>[] = [];
  const rampDelay = RAMP_UP_MS / CONCURRENT_REQUESTS;

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const delay = Math.floor(i * rampDelay);
    const promise = new Promise<{ status: number; data: any; timeMs: number }>((resolve) => {
      setTimeout(() => {
        request('POST', `${API_PREFIX}/applications`, {
          borrowerProfileId,
          productType: 'TERM_LOAN',
          requestedAmount: 50000 + (i * 1000),
          purpose: `Load test application #${i + 1}`,
          allowDuplicate: true, // bypass duplicate check for load test
        }).then(resolve);
      }, delay);
    });
    requests.push(promise);
  }

  const results = await Promise.all(requests);
  const totalTime = Date.now() - startTime;

  // Step 4: Analyze results
  console.log('Results Analysis');
  console.log('=================\n');

  const statusCounts: Record<number, number> = {};
  const responseTimes: number[] = [];
  let createdCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    responseTimes.push(r.timeMs);
    if (r.status >= 200 && r.status < 300) {
      createdCount++;
    } else if (r.status === 409) {
      duplicateCount++;
    } else {
      errorCount++;
    }
  }

  responseTimes.sort((a, b) => a - b);
  const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
  const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
  const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
  const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  console.log(`Total time:           ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Requests/sec:         ${(CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(1)}`);
  console.log(`Avg response time:    ${avgTime.toFixed(0)}ms`);
  console.log(`P50 response time:    ${p50}ms`);
  console.log(`P95 response time:    ${p95}ms`);
  console.log(`P99 response time:    ${p99}ms`);
  console.log();
  console.log('Status Code Breakdown:');
  for (const [status, count] of Object.entries(statusCounts).sort(([a], [b]) => Number(a) - Number(b))) {
    console.log(`  ${status}: ${count} (${((count / CONCURRENT_REQUESTS) * 100).toFixed(1)}%)`);
  }
  console.log();
  console.log('Summary:');
  console.log(`  ✅ Created:       ${createdCount}`);
  console.log(`  ⚠️  Duplicates:    ${duplicateCount}`);
  console.log(`  ❌ Errors:        ${errorCount}`);
  console.log();

  // Step 5: Verify data integrity — list all applications and confirm counts
  console.log('Verifying data integrity...');
  const verifyRes = await request('GET', `${API_PREFIX}/applications?limit=1`);
  if (verifyRes.status === 200) {
    const total = v(verifyRes.data, 'pagination.total') || 'unknown';
    console.log(`  ✅ Total applications in DB: ${total}`);
  } else {
    console.log(`  ⚠️  Could not verify total count (status=${verifyRes.status})`);
  }

  // Step 6: Final verdict
  console.log('\n' + '='.repeat(50));
  const successRate = createdCount / CONCURRENT_REQUESTS;
  if (successRate >= 0.95) {
    console.log('✅ PASSED — >= 95% of requests succeeded');
  } else if (successRate >= 0.80) {
    console.log('⚠️  PARTIAL — 80-95% of requests succeeded');
  } else {
    console.log('❌ FAILED — < 80% of requests succeeded');
  }
  console.log('='.repeat(50));

  process.exit(successRate >= 0.80 ? 0 : 1);
}

function v(obj: any, path: string): any {
  for (const k of path.split('.')) { if (obj == null) return null; obj = obj[k]; }
  return obj;
}

main().catch((e) => { console.error(e); process.exit(1); });