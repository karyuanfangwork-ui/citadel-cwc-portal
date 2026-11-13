const findMany = jest.fn();
jest.mock('../utils/prisma', () => ({ __esModule: true, default: { user: { findMany } } }));
import { userController } from '../controllers/user.controller';

const tenant = '00000000-0000-4000-8000-000000000001';
const requester = '00000000-0000-4000-8000-000000000002';
const candidate = '00000000-0000-4000-8000-000000000003';

async function invoke(user: { id: string; tenantId?: string }) {
    let done!: (value: any) => void;
    const result = new Promise<any>((resolve) => { done = resolve; });
    const res = { json: jest.fn((payload: any) => done(payload)) };
    const next = jest.fn((error: any) => done(error));
    userController.getEligibleHrExecutives({ user } as any, res as any, next);
    return result;
}

describe('HR eligible executive candidate API', () => {
    beforeEach(() => findMany.mockReset());

    it('returns minimal tenant-scoped, active, non-self role-specific options', async () => {
        findMany.mockResolvedValue([{
            id: candidate, firstName: 'Alex', lastName: 'Lee', passwordHash: 'secret',
            roles: [{ role: { name: 'CEO' } }, { role: { name: 'GROUP_DCEO' } }],
        }]);
        const result = await invoke({ id: requester, tenantId: tenant });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
            tenantId: tenant, isActive: true, id: { not: requester },
            roles: { some: { role: { name: { in: ['CEO', 'GROUP_DCEO'] } } } },
        } }));
        expect(result.data.executives).toEqual([
            { id: candidate, firstName: 'Alex', lastName: 'Lee', executiveApproverRole: 'CEO' },
            { id: candidate, firstName: 'Alex', lastName: 'Lee', executiveApproverRole: 'GROUP_DCEO' },
        ]);
        expect(JSON.stringify(result)).not.toContain('secret');
    });

    it('fails closed when tenant context is absent', async () => {
        await expect(invoke({ id: requester })).resolves.toMatchObject({ statusCode: 403 });
        expect(findMany).not.toHaveBeenCalled();
    });
});
