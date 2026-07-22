import { AppError } from '../middleware/error.middleware';
import { PolicyPrincipal } from '../security/policy.types';
import prisma from '../utils/prisma';
import catalogEntitlementService from './catalogEntitlement.service';

interface FormCondition {
    field?: string;
    fieldId?: string;
    operator?: string;
    value?: unknown;
}

interface PublishedFormField {
    id?: string;
    name?: string;
    label?: string;
    type?: string;
    options?: unknown[];
    required?: boolean;
    condition?: FormCondition;
    requiredWhen?: FormCondition;
}

export interface RequestCreationPolicyInput {
    requestTypeId: string;
    serviceDeskId: string;
    formVersion: number;
    values: Record<string, unknown>;
    requestedConfidentiality?: boolean;
}

function hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function conditionApplies(condition: FormCondition | undefined, values: Record<string, unknown>): boolean {
    if (!condition) return true;
    const field = condition.field ?? condition.fieldId;
    if (!field || !condition.operator) return true;

    const actual = values[field];
    switch (condition.operator) {
        case 'equals':
        case 'eq':
            return actual === condition.value;
        case 'notEquals':
        case 'neq':
            return actual !== condition.value;
        case 'in':
            return Array.isArray(condition.value) && condition.value.includes(actual);
        case 'notIn':
            return Array.isArray(condition.value) && !condition.value.includes(actual);
        case 'truthy':
            return Boolean(actual);
        case 'falsy':
            return !actual;
        default:
            // Unknown published operators fail closed by applying the requirement.
            return true;
    }
}

function validatePublishedForm(formConfig: unknown, values: Record<string, unknown>): void {
    if (!Array.isArray(formConfig)) return;

    for (const rawField of formConfig) {
        if (!rawField || typeof rawField !== 'object') continue;
        const field = rawField as PublishedFormField;
        const fieldId = field.id ?? field.name;
        if (!fieldId) continue;
        const condition = field.requiredWhen ?? field.condition;
        if (field.required && conditionApplies(condition, values) && !hasValue(values[fieldId])) {
            throw new AppError(`${field.label || fieldId} is required`, 400);
        }

        const value = values[fieldId];
        if (!hasValue(value)) continue;
        const label = field.label || fieldId;

        if ((field.type === 'number' || field.type === 'currency')
            && (typeof value === 'boolean' || !Number.isFinite(Number(value)))) {
            throw new AppError(`${label} must be a valid number`, 400);
        }
        if (field.type === 'checkbox' && typeof value !== 'boolean') {
            throw new AppError(`${label} must be true or false`, 400);
        }
        if (field.type === 'email'
            && (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
            throw new AppError(`${label} must be a valid email address`, 400);
        }
        if (field.options?.length) {
            const submitted = Array.isArray(value) ? value : [value];
            if (submitted.some((item) => !field.options!.includes(item))) {
                throw new AppError(`${label} contains an invalid option`, 400);
            }
        }
    }
}

/**
 * Resolves every security-relevant request creation property from published
 * server metadata. Caller-provided desk/classification values are only treated
 * as assertions and cannot override the catalog definition.
 */
export async function resolveRequestCreationPolicy(
    principal: PolicyPrincipal,
    input: RequestCreationPolicyInput,
) {
    if (!principal.tenantId) throw new AppError('Request type not found', 404);

    const requestType = await prisma.requestType.findFirst({
        where: {
            id: input.requestTypeId,
            tenantId: principal.tenantId,
        },
        include: {
            serviceCategory: {
                include: { serviceDesk: true },
            },
        },
    });

    const serviceDesk = requestType?.serviceCategory?.serviceDesk;
    if (!requestType
        || !requestType.isActive
        || requestType.lifecycleStatus !== 'PUBLISHED'
        || !serviceDesk
        || !serviceDesk.isActive
        || serviceDesk.id !== input.serviceDeskId
        || serviceDesk.tenantId !== principal.tenantId
        || !serviceDesk.departmentId) {
        throw new AppError('Request type not found', 404);
    }

    if (requestType.requiredRole && !principal.roles.includes(requestType.requiredRole)) {
        throw new AppError('Request type not found', 404);
    }

    const entitled = await catalogEntitlementService.isUserEntitled(requestType.id, {
        id: principal.userId,
        roles: principal.roles,
        agentTeam: principal.agentTeam,
        departmentIds: principal.departmentIds,
        entityId: principal.entityId,
    });
    if (!entitled) throw new AppError('Request type not found', 404);

    if (requestType.formConfigVersion === null
        || input.formVersion !== requestType.formConfigVersion) {
        throw new AppError('Form configuration has changed; refresh and try again', 409);
    }

    validatePublishedForm(requestType.formConfig, input.values);

    return {
        requestType,
        serviceDesk,
        tenantId: serviceDesk.tenantId,
        departmentId: serviceDesk.departmentId,
        workflowTypeId: requestType.workflowTypeId,
        slaHours: requestType.slaHours,
        formVersion: requestType.formConfigVersion,
        formConfig: requestType.formConfig,
        // Confidentiality is derived server-side. Existing HR and Finance desks
        // are classified confidential until catalog classification metadata is
        // introduced as a separately governed field.
        isConfidential: serviceDesk.code === 'HR' || serviceDesk.code === 'FINANCE',
    };
}
