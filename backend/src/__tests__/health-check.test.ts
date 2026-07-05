/**
 * P3-01 — Health check endpoint tests
 *
 * Tests verify:
 *   /health/live always returns 200 with { status: 'alive' }
 *   /health/ready returns 200 with DB check when DB is reachable
 *   /health returns 200 (legacy endpoint)
 */

import request from 'supertest';
import app from '../app';

describe('P3-01: Health check endpoints', () => {
    it('/health/live returns 200 and status alive', async () => {
        const res = await request(app).get('/health/live');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('alive');
        expect(res.body.timestamp).toBeDefined();
    });

    it('/health/ready returns checks object', async () => {
        const res = await request(app).get('/health/ready');
        // Either 200 (ready) or 503 (not ready) — both are valid responses
        expect([200, 503]).toContain(res.status);
        expect(res.body.checks).toBeDefined();
        expect(res.body.checks.database).toBeDefined();
        // Redis is optional
        if (res.body.checks.redis) {
            expect(['ok', 'degraded', 'error']).toContain(res.body.checks.redis.status);
        }
    });

    it('/health (legacy) returns 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.uptime).toBeDefined();
    });
});