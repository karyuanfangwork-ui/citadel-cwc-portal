import { userController } from '../user.controller';
import prisma from '../../utils/prisma';

jest.mock('../../utils/prisma', () => ({
    __esModule: true,
    default: {
        user: { findMany: jest.fn() },
    },
}));

const mockUserFindMany = prisma.user.findMany as jest.Mock;

describe('GET finance approver options', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns only minimal active CEO/Group DCEO picker data', async () => {
        mockUserFindMany.mockResolvedValue([{
            id: 'approver-1',
            firstName: 'Alex',
            lastName: 'Approver',
            roles: [{ role: { name: 'CEO' } }],
            entity: { id: 'entity-1', code: 'CG', name: 'Citadel Group' },
        }]);

        let resolveResponse!: (value: unknown) => void;
        const responseDone = new Promise<unknown>((resolve) => { resolveResponse = resolve; });
        const req = {} as any;
        const res = { json: jest.fn((body: unknown) => resolveResponse(body)) } as any;
        const next = jest.fn((error?: unknown) => {
            if (error) resolveResponse(error);
        });

        userController.getFinanceApprovers(req, res, next);
        const body = await responseDone as any;

        expect(mockUserFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                isActive: true,
                roles: { some: { role: { name: { in: ['CEO', 'GROUP_DCEO'] } } } },
            }),
            select: expect.objectContaining({
                id: true,
                firstName: true,
                lastName: true,
                roles: expect.any(Object),
                entity: expect.any(Object),
            }),
        }));
        expect(body.data.executives).toEqual([expect.objectContaining({
            id: 'approver-1',
            executiveRole: 'CEO',
        })]);
        expect(body.data.executives[0]).not.toHaveProperty('email');
        expect(body.data.executives[0]).not.toHaveProperty('jobTitle');
    });
});
