import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildRegistrationUserData } from '../controllers/auth.controller';

const prisma = new PrismaClient();
const TEST_EMAIL = `lastlogin-register-${Date.now()}@example.com`;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('registration stamps authentication timestamps', () => {
    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
        await prisma.$disconnect();
    });

    it('creates a user with non-null lastLoginAt and lastActiveAt', async () => {
        const before = new Date();
        const user = await prisma.user.create({
            data: {
                ...buildRegistrationUserData({
                    email: TEST_EMAIL,
                    passwordHash: await bcrypt.hash('TestPass1!Secure', 10),
                    firstName: 'Reg',
                    lastName: 'Ister',
                }),
                tenantId: TENANT_ID,
            },
        });

        expect(user.lastLoginAt).not.toBeNull();
        expect(user.lastActiveAt).not.toBeNull();
        expect(user.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
        expect(user.lastActiveAt!.getTime()).toBe(user.lastLoginAt!.getTime());
    });
});
