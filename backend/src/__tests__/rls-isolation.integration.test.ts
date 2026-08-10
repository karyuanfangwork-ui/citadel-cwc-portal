import prisma from '../utils/prisma';
import { withDatabaseScope } from '../lib/database-scope';

process.env.DATABASE_RLS_ROLE = 'cwc_app_rls';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000018';
const TEST_TENANT_B_ID = '00000000-0000-0000-0000-000000000019';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const tenantASlug = `rls-tenant-a-${suffix}`;
const tenantBSlug = `rls-tenant-b-${suffix}`;
const roleName = `RLS_TEST_ROLE_${suffix}`;
const userAEmail = `rls-user-a-${suffix}@test.local`;
const userBEmail = `rls-user-b-${suffix}@test.local`;
const deptACode = `RLS-A-${suffix}`.slice(0, 48);
const deptBCode = `RLS-B-${suffix}`.slice(0, 48);
const requestARef = `RLS-A-${suffix}`.slice(0, 48);
const requestBRef = `RLS-B-${suffix}`.slice(0, 48);

let roleId: string;
let userAId: string;
let userBId: string;
let deptAId: string;
let deptBId: string;
let requestAId: string;
let requestBId: string;

describe('Task 19: PostgreSQL RLS tenant and department isolation', () => {
    beforeAll(async () => {
        await Promise.all([
            prisma.tenant.upsert({
                where: { id: TEST_TENANT_ID },
                update: { name: 'RLS Tenant A', slug: tenantASlug, isActive: true },
                create: { id: TEST_TENANT_ID, name: 'RLS Tenant A', slug: tenantASlug, isActive: true },
            }),
            prisma.tenant.upsert({
                where: { id: TEST_TENANT_B_ID },
                update: { name: 'RLS Tenant B', slug: tenantBSlug, isActive: true },
                create: { id: TEST_TENANT_B_ID, name: 'RLS Tenant B', slug: tenantBSlug, isActive: true },
            }),
        ]);

        const role = await prisma.role.create({ data: { name: roleName } });
        roleId = role.id;

        const [deptA, deptB] = await Promise.all([
            prisma.department.create({ data: { tenantId: TEST_TENANT_ID, code: deptACode, name: `RLS Dept A ${suffix}` } }),
            prisma.department.create({ data: { tenantId: TEST_TENANT_B_ID, code: deptBCode, name: `RLS Dept B ${suffix}` } }),
        ]);
        deptAId = deptA.id;
        deptBId = deptB.id;

        const [userA, userB] = await Promise.all([
            prisma.user.create({
                data: {
                    email: userAEmail,
                    tenantId: TEST_TENANT_ID,
                    passwordHash: 'not-used',
                    firstName: 'RLS',
                    lastName: 'UserA',
                    isActive: true,
                },
            }),
            prisma.user.create({
                data: {
                    email: userBEmail,
                    tenantId: TEST_TENANT_B_ID,
                    passwordHash: 'not-used',
                    firstName: 'RLS',
                    lastName: 'UserB',
                    isActive: true,
                },
            }),
        ]);
        userAId = userA.id;
        userBId = userB.id;

        await prisma.departmentMembership.createMany({
            data: [
                { tenantId: TEST_TENANT_ID, departmentId: deptAId, userId: userAId, roleId },
                { tenantId: TEST_TENANT_B_ID, departmentId: deptBId, userId: userBId, roleId },
            ],
        });

        const [requestA, requestB] = await Promise.all([
            (prisma as any).request.create({
                data: {
                    tenantId: TEST_TENANT_ID,
                    departmentId: deptAId,
                    referenceNumber: requestARef,
                    requesterId: userAId,
                    requesterEmail: userAEmail,
                    summary: 'RLS tenant A IT request',
                    description: 'visible only to tenant A / department A',
                },
            }),
            (prisma as any).request.create({
                data: {
                    tenantId: TEST_TENANT_B_ID,
                    departmentId: deptBId,
                    referenceNumber: requestBRef,
                    requesterId: userBId,
                    requesterEmail: userBEmail,
                    summary: 'RLS tenant B HR request',
                    description: 'visible only to tenant B / department B',
                },
            }),
        ]);
        requestAId = requestA.id;
        requestBId = requestB.id;

        await prisma.$executeRawUnsafe(`ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "requests" FORCE ROW LEVEL SECURITY`);
    });

    afterAll(async () => {
        await withDatabaseScope(
            { tenantId: TEST_TENANT_ID, departmentIds: [deptAId], actorId: userAId },
            async (tx: any) => tx.request.deleteMany({ where: { id: requestAId } }),
        ).catch(() => undefined);
        await withDatabaseScope(
            { tenantId: TEST_TENANT_B_ID, departmentIds: [deptBId], actorId: userBId },
            async (tx: any) => tx.request.deleteMany({ where: { id: requestBId } }),
        ).catch(() => undefined);
        await prisma.departmentMembership.deleteMany({ where: { userId: { in: [userAId, userBId].filter(Boolean) } } }).catch(() => undefined);
        await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId].filter(Boolean) } } }).catch(() => undefined);
        await prisma.department.deleteMany({ where: { id: { in: [deptAId, deptBId].filter(Boolean) } } }).catch(() => undefined);
        await prisma.role.deleteMany({ where: { id: roleId } }).catch(() => undefined);
        await prisma.tenant.deleteMany({ where: { id: { in: [TEST_TENANT_ID, TEST_TENANT_B_ID] } } }).catch(() => undefined);
        // Prisma is closed by the global Jest teardown.
    });

    it('denies direct SQL reads across tenant and department even when the target id is named', async () => {
        await withDatabaseScope(
            { tenantId: TEST_TENANT_ID, departmentIds: [deptAId], actorId: userAId },
            async (tx: any) => {
                const ownRows = await tx.$queryRawUnsafe(
                    `SELECT id FROM "requests" WHERE id = $1::uuid`,
                    requestAId,
                );
                const otherTenantRows = await tx.$queryRawUnsafe(
                    `SELECT id FROM "requests" WHERE id = $1::uuid`,
                    requestBId,
                );

                expect(ownRows).toHaveLength(1);
                expect(otherTenantRows).toHaveLength(0);
            },
        );
    });

    it('denies direct SQL mutations across tenant and department even when the target id is named', async () => {
        await withDatabaseScope(
            { tenantId: TEST_TENANT_ID, departmentIds: [deptAId], actorId: userAId },
            async (tx: any) => {
                const ownUpdate = await tx.$executeRawUnsafe(
                    `UPDATE "requests" SET summary = 'RLS tenant A updated' WHERE id = $1::uuid`,
                    requestAId,
                );
                const otherTenantUpdate = await tx.$executeRawUnsafe(
                    `UPDATE "requests" SET summary = 'RLS tenant B leaked update' WHERE id = $1::uuid`,
                    requestBId,
                );

                expect(ownUpdate).toBe(1);
                expect(otherTenantUpdate).toBe(0);
            },
        );
    });

    it('applies Prisma queries inside withDatabaseScope and clears claims between pooled transactions', async () => {
        const visibleToA = await withDatabaseScope(
            { tenantId: TEST_TENANT_ID, departmentIds: [deptAId], actorId: userAId },
            async (tx: any) => tx.request.findMany({
                where: { id: { in: [requestAId, requestBId] } },
                select: { id: true },
                orderBy: { id: 'asc' },
            }),
        );

        const visibleToB = await withDatabaseScope(
            { tenantId: TEST_TENANT_B_ID, departmentIds: [deptBId], actorId: userBId },
            async (tx: any) => tx.request.findMany({
                where: { id: { in: [requestAId, requestBId] } },
                select: { id: true },
                orderBy: { id: 'asc' },
            }),
        );

        expect(visibleToA.map((row: { id: string }) => row.id)).toEqual([requestAId]);
        expect(visibleToB.map((row: { id: string }) => row.id)).toEqual([requestBId]);

        await prisma.$transaction(async (tx: any) => {
            await tx.$executeRawUnsafe(`SET LOCAL ROLE "cwc_app_rls"`);
            const unscopedRows = await tx.$queryRawUnsafe(
                `SELECT id FROM "requests" WHERE id IN ($1::uuid, $2::uuid)`,
                requestAId,
                requestBId,
            );
            expect(unscopedRows).toHaveLength(0);
        });
    });
});
