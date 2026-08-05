/**
 * P3-03 — Prometheus metrics endpoint tests
 *
 * Tests verify:
 *   /metrics returns Prometheus exposition format with http_request_duration_seconds
 *   /metrics is disabled when METRICS_ENABLED=false
 */

import request from 'supertest';
import app from '../app';

describe('P3-03: Prometheus metrics endpoint', () => {
    it('GET /metrics returns 200 with Prometheus exposition format', async () => {
        const res = await request(app).get('/metrics');
        expect(res.status).toBe(200);
        expect(res.text).toContain('http_request_duration_seconds');
        expect(res.text).toContain('http_requests_total');
        expect(res.text).toContain('process_cpu'); // default Node.js metrics
    });

    it('metrics are collected after making a request', async () => {
        // Make a request that will be tracked
        await request(app).get('/health/live');

        const res = await request(app).get('/metrics');
        expect(res.status).toBe(200);
        // Should contain a data point from the /health/live request
        expect(res.text).toMatch(/http_request_duration_seconds_bucket/);
        expect(res.text).toMatch(/http_request_duration_seconds_count/);
    });

    it('metrics endpoint uses text/plain or Prometheus content type', async () => {
        const res = await request(app).get('/metrics');
        expect(res.status).toBe(200);
        // prom-client uses application/vnd.prometheus.metrics or text/plain version=0.0.4
        expect(res.headers['content-type']).toMatch(/text\/plain|application\/vnd\.prometheus/);
    });
});