#!/usr/bin/env node
/**
 * P3-09: Baseline load test for CWC API
 *
 * Lightweight load test using Node.js built-in HTTP client (no external deps).
 * Targets the health and auth endpoints to establish baseline throughput.
 *
 * Usage:
 *   node scripts/load/baseline-load-test.js [--concurrency 10] [--duration 30] [--base-url http://localhost:3000]
 *
 * Requirements:
 *   - Backend server running at BASE_URL
 *   - No authentication needed for /health/* endpoints
 *
 * This is a FIRST-PASS load test. For production load testing, use k6, Artillery,
 * or Locust with proper ramp-up scenarios.
 */

const http = require('http');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : defaultVal;
}

const CONCURRENCY = parseInt(getArg('concurrency', '10'), 10);
const DURATION_SEC = parseInt(getArg('duration', '30'), 10);
const BASE_URL = getArg('base-url', 'http://localhost:3000');

// ── Endpoints to test ────────────────────────────────────────────────────────

const ENDPOINTS = [
    { method: 'GET', path: '/health/live', name: 'liveness' },
    { method: 'GET', path: '/health/ready', name: 'readiness' },
    { method: 'GET', path: '/health', name: 'legacy-health' },
    { method: 'GET', path: '/metrics', name: 'metrics' },
];

// ── HTTP request helper ─────────────────────────────────────────────────────

function makeRequest(url) {
    return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        const client = url.startsWith('https') ? https : http;

        const req = client.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
                resolve({
                    status: res.statusCode,
                    durationMs,
                    error: null,
                    bodyLength: body.length,
                });
            });
        });

        req.on('error', (err) => {
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
            resolve({
                status: 0,
                durationMs,
                error: err.message,
                bodyLength: 0,
            });
        });

        req.setTimeout(10000, () => {
            req.destroy(new Error('timeout'));
        });
    });
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function runTest() {
    console.log('════════════════════════════════════════════════════════');
    console.log('  CWC Baseline Load Test');
    console.log('════════════════════════════════════════════════════════');
    console.log(`  Base URL:     ${BASE_URL}`);
    console.log(`  Concurrency:  ${CONCURRENCY}`);
    console.log(`  Duration:     ${DURATION_SEC}s`);
    console.log(`  Endpoints:    ${ENDPOINTS.map(e => e.name).join(', ')}`);
    console.log('');

    const results = {};
    for (const ep of ENDPOINTS) {
        results[ep.name] = { successes: 0, errors: 0, totalMs: 0, statusCodes: {}, minMs: Infinity, maxMs: 0 };
    }

    const startTime = Date.now();
    const endTime = startTime + DURATION_SEC * 1000;
    let totalRequests = 0;

    async function worker(id) {
        while (Date.now() < endTime) {
            // Round-robin through endpoints
            for (const ep of ENDPOINTS) {
                if (Date.now() >= endTime) break;

                const url = `${BASE_URL}${ep.path}`;
                const result = await makeRequest(url);
                totalRequests++;

                const stats = results[ep.name];
                if (result.error || result.status >= 400) {
                    stats.errors++;
                } else {
                    stats.successes++;
                }
                stats.totalMs += result.durationMs;
                stats.minMs = Math.min(stats.minMs, result.durationMs);
                stats.maxMs = Math.max(stats.maxMs, result.durationMs);
                stats.statusCodes[result.status] = (stats.statusCodes[result.status] || 0) + 1;
            }
        }
    }

    // Run workers
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(worker(i));
    }
    await Promise.all(workers);

    const elapsedSec = (Date.now() - startTime) / 1000;

    // ── Report ───────────────────────────────────────────────────────────────

    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  Results');
    console.log('════════════════════════════════════════════════════════');
    console.log(`  Total time:    ${elapsedSec.toFixed(1)}s`);
    console.log(`  Total reqs:    ${totalRequests}`);
    console.log(`  Throughput:    ${(totalRequests / elapsedSec).toFixed(1)} req/s`);
    console.log('');

    for (const ep of ENDPOINTS) {
        const s = results[ep.name];
        const avgMs = s.successes + s.errors > 0 ? s.totalMs / (s.successes + s.errors) : 0;
        const p50 = avgMs; // simplified — for p50/p95 use k6
        const total = s.successes + s.errors;

        console.log(`  ── ${ep.name} (${ep.path}) ──`);
        console.log(`    Requests:  ${total} (${s.successes} ok, ${s.errors} errors)`);
        console.log(`    Avg latency: ${avgMs.toFixed(1)}ms`);
        console.log(`    Min/Max:     ${s.minMs.toFixed(1)}ms / ${s.maxMs.toFixed(1)}ms`);
        console.log(`    Status codes: ${Object.entries(s.statusCodes).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
        console.log('');
    }

    console.log('  ── Summary ──');
    const overallAvg = Object.values(results).reduce((sum, s) => sum + s.totalMs, 0) / Math.max(totalRequests, 1);
    const overallErrors = Object.values(results).reduce((sum, s) => sum + s.errors, 0);
    console.log(`    Overall avg latency: ${overallAvg.toFixed(1)}ms`);
    console.log(`    Overall error rate:  ${((overallErrors / Math.max(totalRequests, 1)) * 100).toFixed(1)}%`);
    console.log(`    Overall throughput:   ${(totalRequests / elapsedSec).toFixed(1)} req/s`);
    console.log('');

    // Exit with error if error rate > 5%
    if (overallErrors / Math.max(totalRequests, 1) > 0.05) {
        console.error('❌ Error rate exceeds 5% — baseline FAILED');
        process.exit(1);
    }

    console.log('✅ Baseline load test PASSED');
    process.exit(0);
}

runTest().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(2);
});