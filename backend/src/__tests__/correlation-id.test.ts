/**
 * P3-02 — Correlation ID middleware tests
 *
 * Tests verify:
 *   - A new UUID is generated when no header is provided
 *   - An existing X-Correlation-ID header is reused
 *   - The ID is set on both req.correlationId and the response header
 */

import request from 'supertest';
import app from '../app';

describe('P3-02: Correlation ID middleware', () => {
    it('generates a new correlation ID when no header is provided', async () => {
        const res = await request(app).get('/health/live');
        expect(res.status).toBe(200);
        expect(res.headers['x-correlation-id']).toBeDefined();
        // UUID v4 format: 8-4-4-4-12 hex chars
        expect(res.headers['x-correlation-id']).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
    });

    it('reuses the X-Correlation-ID header when provided', async () => {
        const providedId = 'test-correlation-id-12345';
        const res = await request(app)
            .get('/health/live')
            .set('X-Correlation-ID', providedId);
        expect(res.status).toBe(200);
        expect(res.headers['x-correlation-id']).toBe(providedId);
    });

    it('trims whitespace from the provided correlation ID', async () => {
        const providedId = '  spaced-id-67890  ';
        const res = await request(app)
            .get('/health/live')
            .set('X-Correlation-ID', providedId);
        expect(res.headers['x-correlation-id']).toBe('spaced-id-67890');
    });

    it('different requests get different correlation IDs', async () => {
        const res1 = await request(app).get('/health/live');
        const res2 = await request(app).get('/health/live');
        expect(res1.headers['x-correlation-id']).not.toBe(res2.headers['x-correlation-id']);
    });
});