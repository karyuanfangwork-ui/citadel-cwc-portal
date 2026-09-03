import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../app';

const prisma = new PrismaClient();
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_EMAIL = `authaudit-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass1!Secure';
let userId: string;

function cookies(res: request.Response): string {
    const raw = (res.headers['set-cookie'] as unknown as string[]) || [];
    return raw.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('authentication audit trail', () => {
    beforeAll(async () => {
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
                firstName: 'Aud',
                lastName: 'Itor',
                isActive: true,
                tenantId: TENANT_ID,
            },
        });
        userId = user.id;
    });

    afterAll(async () => {
        await prisma.auditLog.deleteMany({ where: { userEmail: TEST_EMAIL } });
        await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
        await prisma.$disconnect();
    });

    it('records successful login with request metadata', async () => {
        const res = await request(app).post('/api/v1/auth/login').set('User-Agent', 'auth-audit-test').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
        expect(res.status).toBe(200);
        const row = await prisma.auditLog.findFirst({ where: { userEmail: TEST_EMAIL, action: 'AUTH_LOGIN_SUCCESS' }, orderBy: { createdAt: 'desc' } });
        expect(row).not.toBeNull();
        expect(row!.resourceType).toBe('AUTH');
        expect(row!.userId).toBe(userId);
        expect(row!.userAgent).toBe('auth-audit-test');
    });

    it('records wrong-password and unknown-email attempts without enumeration', async () => {
        const bad = await request(app).post('/api/v1/auth/login').send({ email: TEST_EMAIL, password: 'WrongPass1!Secure' });
        expect(bad.status).toBe(401);
        const badRow = await prisma.auditLog.findFirst({ where: { userEmail: TEST_EMAIL, action: 'AUTH_LOGIN_FAILED' }, orderBy: { createdAt: 'desc' } });
        expect((badRow!.newValues as { reason: string }).reason).toBe('INVALID_PASSWORD');

        const unknownEmail = `nosuchuser-${Date.now()}@example.com`;
        const unknown = await request(app).post('/api/v1/auth/login').send({ email: unknownEmail, password: TEST_PASSWORD });
        expect(unknown.status).toBe(401);
        expect(unknown.body.message).toBe('Invalid email or password');
        const unknownRow = await prisma.auditLog.findFirst({ where: { userEmail: unknownEmail, action: 'AUTH_LOGIN_FAILED' } });
        expect(unknownRow?.userId).toBeNull();
        await prisma.auditLog.deleteMany({ where: { userEmail: unknownEmail } });
    });

    it('records logout', async () => {
        const login = await request(app).post('/api/v1/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
        const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookies(login));
        expect(res.status).toBe(200);
        const row = await prisma.auditLog.findFirst({ where: { userEmail: TEST_EMAIL, action: 'AUTH_LOGOUT' }, orderBy: { createdAt: 'desc' } });
        expect(row).not.toBeNull();
    });
});
