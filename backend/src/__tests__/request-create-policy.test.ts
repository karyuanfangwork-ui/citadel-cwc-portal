/**
 * Task 13 server-authoritative request creation policy contracts.
 */

const mockRequestTypeFindFirst = jest.fn();
const mockIsUserEntitled = jest.fn();

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        requestType: { findFirst: mockRequestTypeFindFirst },
    },
}));

jest.mock('../services/catalogEntitlement.service', () => ({
    __esModule: true,
    default: { isUserEntitled: mockIsUserEntitled },
}));

import { resolveRequestCreationPolicy } from '../services/requestCreationPolicy.service';

const principal = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    roles: ['END_USER'],
    permissions: ['request:create'],
    departmentIds: ['department-it'],
    agentTeam: 'IT',
};

const publishedType = {
    id: 'type-it',
    tenantId: 'tenant-1',
    code: 'NEW_HARDWARE',
    name: 'New Hardware',
    isActive: true,
    lifecycleStatus: 'PUBLISHED',
    formConfigVersion: 3,
    formConfig: [
        { id: 'hardwareName', label: 'Hardware Name', type: 'text', required: true },
        { id: 'needsAccessories', label: 'Needs Accessories', type: 'select', required: false, options: ['Yes', 'No'] },
        {
            id: 'accessoryDetails',
            label: 'Accessory Details',
            type: 'textarea',
            required: true,
            condition: { field: 'needsAccessories', operator: 'equals', value: 'Yes' },
        },
    ],
    slaHours: 24,
    workflowTypeId: 'workflow-1',
    requiredRole: null,
    classification: 'INTERNAL',
    serviceCategory: {
        id: 'category-it',
        serviceDesk: {
            id: 'desk-it',
            tenantId: 'tenant-1',
            departmentId: 'department-it',
            code: 'IT',
            isActive: true,
        },
    },
};

describe('Task 13 request creation policy', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRequestTypeFindFirst.mockResolvedValue(publishedType);
        mockIsUserEntitled.mockResolvedValue(true);
    });

    it('rejects a request type submitted through a different service desk', async () => {
        await expect(resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-hr',
            formVersion: 3,
            values: { hardwareName: 'Laptop' },
        })).rejects.toThrow('Request type not found');
    });

    it.each([
        { isActive: false, lifecycleStatus: 'PUBLISHED' },
        { isActive: true, lifecycleStatus: 'DRAFT' },
        { isActive: true, lifecycleStatus: 'RETIRED' },
    ])('rejects inactive or unpublished catalog types: %o', async (state) => {
        mockRequestTypeFindFirst.mockResolvedValue({ ...publishedType, ...state });

        await expect(resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { hardwareName: 'Laptop' },
        })).rejects.toThrow('Request type not found');
    });

    it('rejects principals without a matching catalog entitlement', async () => {
        mockIsUserEntitled.mockResolvedValue(false);

        await expect(resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { hardwareName: 'Laptop' },
        })).rejects.toThrow('Request type not found');
    });

    it('rejects stale form versions', async () => {
        await expect(resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 2,
            values: { hardwareName: 'Laptop' },
        })).rejects.toThrow('Form configuration has changed');
    });

    it('enforces required and conditionally required fields from the published form', async () => {
        await expect(resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { needsAccessories: 'Yes' },
        })).rejects.toThrow('Hardware Name is required');

        await expect(resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { hardwareName: 'Laptop', needsAccessories: 'Yes' },
        })).rejects.toThrow('Accessory Details is required');
    });

    it('rejects values outside the published field contract', async () => {
        await expect(resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { hardwareName: 'Laptop', needsAccessories: 'Maybe' },
        })).rejects.toThrow('Needs Accessories contains an invalid option');
    });

    it('returns server-owned desk, department, workflow, SLA and classification', async () => {
        const result = await resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { hardwareName: 'Laptop', needsAccessories: 'No' },
        });

        expect(result).toMatchObject({
            requestType: publishedType,
            serviceDesk: publishedType.serviceCategory.serviceDesk,
            tenantId: 'tenant-1',
            departmentId: 'department-it',
            workflowTypeId: 'workflow-1',
            slaHours: 24,
            classification: 'INTERNAL',
            isConfidential: false,
            formVersion: 3,
        });
    });

    it('forces confidentiality for CONFIDENTIAL classification regardless of a false client flag', async () => {
        mockRequestTypeFindFirst.mockResolvedValue({
            ...publishedType,
            classification: 'CONFIDENTIAL',
            serviceCategory: {
                ...publishedType.serviceCategory,
                serviceDesk: {
                    ...publishedType.serviceCategory.serviceDesk,
                    id: 'desk-hr',
                    departmentId: 'department-hr',
                    code: 'HR',
                },
            },
        });

        const result = await resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-hr',
            formVersion: 3,
            values: { hardwareName: 'Laptop', needsAccessories: 'No' },
            requestedConfidentiality: false,
        });

        expect(result.isConfidential).toBe(true);
    });

    it('allows user choice for INTERNAL classification', async () => {
        const result = await resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { hardwareName: 'Laptop', needsAccessories: 'No' },
            requestedConfidentiality: true,
        });

        expect(result.isConfidential).toBe(true);
    });

    it('returns classification metadata for frontend consumption', async () => {
        const result = await resolveRequestCreationPolicy(principal, {
            requestTypeId: 'type-it',
            serviceDeskId: 'desk-it',
            formVersion: 3,
            values: { hardwareName: 'Laptop', needsAccessories: 'No' },
        });

        expect(result.classification).toBe('INTERNAL');
        expect(result).toHaveProperty('tenantId');
        expect(result).toHaveProperty('departmentId');
        expect(result).toHaveProperty('workflowTypeId');
        expect(result).toHaveProperty('slaHours');
        expect(result).toHaveProperty('formVersion');
    });
});
