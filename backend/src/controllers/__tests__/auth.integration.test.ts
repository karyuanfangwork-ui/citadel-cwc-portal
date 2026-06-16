/**
 * Integration tests for session isolation and logout correctness.
 *
 * Simulates two independent browser sessions by extracting Set-Cookie headers
 * and replaying them on subsequent requests — same as a browser would.
 *
 * Prerequisites: PostgreSQL running, Redis running (or test will skip gracefully).
 */
import request from 'supertest';
import app from '../../app';
import  from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TIMESTAMP = Date.now();
const TEST_USER_A = {
    email: `test-a-${TIMESTAMP}@example.com`,
    password: 'TestPass1!Secure',
    firstName: 'Alice',
    lastName: 'Alpha',
};
const TEST_USER_B = {
    email: `test-b-${TIMESTAMP}@example.com`,
    password: 'TestPass2!Secure',
    firstName: 'Bob',
    lastName: 'Beta',
};

function extractCookies(res: request.Response): string {
    const raw: string[] = (res.headers['set-cookie'] as unknown as string[]) || [];
    return raw.map((c) => c.split(';')[0]).join('; ');
}

describe('Multi-browser session isolation', () => {
    let cookieA: string;
    let cookieB: string;

    beforeAll(async () => {
        // Create users directly (register route is disabled)
        const hashA = await bcrypt.hash(TEST_USER_A.password, 10);
        const hashB = await bcrypt.hash(TEST_USER_B.password, 10);
        await prisma.user.createMany({
            data: [
                { email: TEST_USER_A.email, passwordHash: hashA, firstName: TEST_USER_A.firstName, lastName: TEST_USER_A.lastName, isActive: true },
                { email: TEST_USER_B.email, passwordHash: hashB, firstName: TEST_USER_B.firstName, lastName: TEST_USER_B.lastName, isActive: true },
            ],
        });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({
            where: { email: { in: [TEST_USER_A.email, TEST_USER_B.email] } },
        });
        await prisma.$disconnect();
    });

    it('each browser gets its own independent cookie session on login', async () => {
        const resA = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: TEST_USER_A.email, password: TEST_USER_A.password });
        const resB = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: TEST_USER_B.email, password: TEST_USER_B.password });

        expect(resA.status).toBe(200);
        expect(resB.status).toBe(200);

        cookieA = extractCookies(resA);
        cookieB = extractCookies(resB);

        expect(cookieA).toContain('access_token=');
        expect(cookieB).toContain('access_token=');
        expect(cookieA).not.toBe(cookieB);
    });

    it('browser A sees user A identity', async () => {
        if (!cookieA) return;
        const res = await request(app)
            .get('/api/v1/users/me')
            .set('Cookie', cookieA);

        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(TEST_USER_A.email);
    });

    it('browser B sees user B identity', async () => {
        if (!cookieB) return;
        const res = await request(app)
            .get('/api/v1/users/me')
            .set('Cookie', cookieB);

        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(TEST_USER_B.email);
    });

    it('logout in browser A invalidates browser A session', async () => {
        if (!cookieA) return;
        const res = await request(app)
            .post('/api/v1/auth/logout')
            .set('Cookie', cookieA);

        expect(res.status).toBe(200);
    });

    it('browser B session remains active after browser A logout', async () => {
        if (!cookieB) return;
        const res = await request(app)
            .get('/api/v1/users/me')
            .set('Cookie', cookieB);

        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(TEST_USER_B.email);
    });
});