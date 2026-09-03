import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { pruneExpiredSessions } from '../jobs/session-pruner';

const prisma = new PrismaClient();
const TEST_EMAIL = `sessionprune-${Date.now()}@example.com`;
const EXPIRED_TOKEN = `expired-token-${Date.now()}`;
const LIVE_TOKEN = `live-token-${Date.now()}`;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
let userId: string;

describe('pruneExpiredSessions', () => {
    beforeAll(async () => {
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                passwordHash: await bcrypt.hash('TestPass1!Secure', 10),
                firstName: 'Prune',
                lastName: 'Target',
                tenantId: TENANT_ID,
            },
        });
        userId = user.id;
        await prisma.session.createMany({
            data: [
                { userId, token: EXPIRED_TOKEN, expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
                { userId, token: LIVE_TOKEN, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
            ],
        });
    });

    afterAll(async () => {
        await prisma.session.deleteMany({ where: { token: { in: [EXPIRED_TOKEN, LIVE_TOKEN] } } });
        await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
        await prisma.$disconnect();
    });

    it('deletes expired sessions and keeps live sessions', async () => {
        expect(await pruneExpiredSessions()).toBeGreaterThanOrEqual(1);
        expect(await prisma.session.findUnique({ where: { token: EXPIRED_TOKEN } })).toBeNull();
        expect(await prisma.session.findUnique({ where: { token: LIVE_TOKEN } })).not.toBeNull();
    });
});
