const policy = jest.fn();
const resolve = jest.fn();
const create = jest.fn();
const activity = jest.fn();
const transaction = jest.fn();
const assign = jest.fn();
const notify = jest.fn();
const audit = jest.fn();
jest.mock('../utils/prisma', () => ({ __esModule: true, default: {
    $transaction: transaction, request: { findUnique: jest.fn() }, requestActivity: { create: activity },
} }));
jest.mock('../services/requestCreationPolicy.service', () => ({ resolveRequestCreationPolicy: policy }));
jest.mock('../services/hrExecutiveApprover.service', () => ({ resolveHrExecutiveApprover: resolve }));
jest.mock('../services/referenceNumber.service', () => ({ generateRequestRefNum: jest.fn(async () => 'HR-TEST') }));
jest.mock('../services/entityRouting.service', () => ({ applyEntityRouting: jest.fn(async () => undefined) }));
jest.mock('../services/autoAssignment.service', () => ({ autoAssignRequest: assign }));
jest.mock('../services/notification.service', () => ({ notify }));
jest.mock('../utils/audit', () => ({ auditLog: audit }));
import { requestController } from '../controllers/request.controller';

const requesterId = '00000000-0000-4000-8000-000000000001';
const executiveApproverId = '00000000-0000-4000-8000-000000000002';
const tenantId = '00000000-0000-4000-8000-000000000003';
const base = { requestTypeId: requesterId, serviceDeskId: tenantId, formVersion: 1, summary: 'Hiring' };
async function invoke(body: object) {
    let done!: (value: any) => void;
    const result = new Promise<any>((r) => { done = r; });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn((value) => done(value)) };
    requestController.createRequest({ body, user: { id: requesterId, tenantId, email: 'staff@test.local', roles: [] } } as any, res as any, (error: any) => done(error));
    return { value: await result, res };
}
beforeEach(() => {
    jest.clearAllMocks();
    policy.mockResolvedValue({
        tenantId, departmentId: null, serviceDesk: { code: 'HR' },
        requestType: { code: 'NEW_HIRING', name: 'New Hiring', formConfig: [] },
        formConfig: [], formVersion: 1, isConfidential: false,
    });
    resolve.mockImplementation(async ({ executiveApproverId: id, executiveApproverRole: role }) => ({ id, role }));
    assign.mockResolvedValue({ success: false });
    transaction.mockImplementation(async (fn) => fn({ request: { create }, requestActivity: { create: activity } }));
    create.mockImplementation(async ({ data }) => ({ id: 'created', ...data, requestType: { code: 'NEW_HIRING', name: 'New Hiring' } }));
});

describe('NEW_HIRING create persistence', () => {
    it('requires an executive choice before any transaction', async () => {
        const { value } = await invoke(base);
        expect(value).toMatchObject({ statusCode: 400 });
        expect(create).not.toHaveBeenCalled();
    });
    it.each(['CEO', 'GROUP_DCEO'] as const)('persists selected %s in the create transaction without creating approval or assigning executive', async (role) => {
        const { res } = await invoke({ ...base, executiveApproverId, executiveApproverRole: role });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(resolve).toHaveBeenCalledWith({ executiveApproverId, executiveApproverRole: role, tenantId, requesterId });
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
            executiveApproverId, executiveApproverRole: role, status: 'SUBMITTED', assignedToId: undefined,
        }) }));
    });
    it('rejects a choice for another request type', async () => {
        policy.mockResolvedValue({ tenantId, serviceDesk: { code: 'IT' }, requestType: { code: 'GET_IT_HELP' }, formVersion: 1 });
        const { value } = await invoke({ ...base, executiveApproverId, executiveApproverRole: 'CEO' });
        expect(value).toMatchObject({ statusCode: 400 });
        expect(create).not.toHaveBeenCalled();
    });
});
