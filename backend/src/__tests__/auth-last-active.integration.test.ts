import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../app';

const prisma = new PrismaClient();
const TEST_EMAIL = `lastactive-${Date.now()}@example.com`;
const PASSWORD = 'TestPass1!Secure';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function cookies(res: request.Response): string {
    const raw = (res.headers['set-cookie'] as unknown as string[]) || [];
    return raw.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('lastActiveAt on token refresh', () => {
    beforeAll(async () => {
        await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                passwordHash: await bcrypt.hash(PASSWORD, 10),
                firstName: 'Active',
                lastName: 'User',
                tenantId: TENANT_ID,
            },
        });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
        await prisma.$disconnect();
    });

    it('advances lastActiveAt on refresh while lastLoginAt remains fixed', async () => {
        const login = await request(app).post('/api/v1/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });
        expect(login.status).toBe(200);
        const afterLogin = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
        expect(afterLogin?.lastLoginAt).not.toBeNull();
        expect(afterLogin?.lastActiveAt).not.toBeNull();

        await new Promise((resolve) => setTimeout(resolve, 1100));
        const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies(login));
        expect(refresh.status).toBe(200);

        const afterRefresh = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
        expect(afterRefresh!.lastActiveAt!.getTime()).toBeGreaterThan(afterLogin!.lastActiveAt!.getTime());
        expect(afterRefresh!.lastLoginAt!.getTime()).toBe(afterLogin!.lastLoginAt!.getTime());
    });
});
