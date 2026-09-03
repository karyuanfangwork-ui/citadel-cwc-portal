import { RequestStatusLifecycleType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';

export const STATUS_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,99}$/;

export interface StatusDefinitionInput {
  code?: unknown;
  label?: unknown;
  description?: unknown;
  category?: unknown;
  displayOrder?: unknown;
  isActive?: unknown;
  lifecycleType?: unknown;
  retiredAt?: unknown;
}

export interface StatusDefinitionScope {
  workflowTypeId?: string;
  category?: string;
}

export const normalizeStatusCode = (value: unknown): string => {
  if (typeof value !== 'string') throw new AppError('Status code is required', 422);
  const code = value.trim().toUpperCase();
  if (!STATUS_CODE_PATTERN.test(code)) {
    throw new AppError('Status code must start with a letter and contain only A-Z, 0-9, and underscores', 422);
  }
  return code;
};

const requiredLabel = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('Status label is required', 422);
  return value.trim();
};

const optionalText = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError('Status text fields must be strings', 422);
  return value.trim() || null;
};

const lifecycle = (value: unknown): RequestStatusLifecycleType => {
  if (value === undefined || value === null || value === '') return RequestStatusLifecycleType.OPEN;
  if (!Object.values(RequestStatusLifecycleType).includes(value as RequestStatusLifecycleType)) {
    throw new AppError(`Invalid status lifecycle type: ${String(value)}`, 422);
  }
  return value as RequestStatusLifecycleType;
};

const displayOrder = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new AppError('Display order must be a non-negative integer', 422);
  }
  return value;
};

const isActive = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') throw new AppError('isActive must be boolean', 422);
  return value;
};

export function validateStatusDefinitionInput(input: StatusDefinitionInput, requireCode = true) {
  const code = input.code === undefined && !requireCode ? undefined : normalizeStatusCode(input.code);
  const label = requiredLabel(input.label);
  const category = optionalText(input.category);
  const description = optionalText(input.description);
  const lifecycleType = lifecycle(input.lifecycleType);
  const active = isActive(input.isActive);
  const order = displayOrder(input.displayOrder);
  return { code, label, category, description, lifecycleType, isActive: active, displayOrder: order };
}

export async function getActiveStatusDefinitions(scope: StatusDefinitionScope = {}, client: any = prisma) {
  const definitions = await client.requestStatusDefinition.findMany({
    where: {
      isActive: true,
      retiredAt: null,
      ...(scope.category ? { category: scope.category } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
  });

  if (!scope.workflowTypeId) return definitions;

  const workflow = await client.workflowType.findUnique({
    where: { id: scope.workflowTypeId },
    select: { code: true },
  });
  if (!workflow) throw new AppError('Workflow type not found', 404);

  const category = workflow.code.split('_')[0]?.toUpperCase();
  const workflowCategories = new Set([workflow.code.toUpperCase(), category, 'GENERAL']);
  return definitions.filter((definition: { category: string | null }) => {
    if (!definition.category) return true;
    const categories = definition.category
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    return categories.some((value) => workflowCategories.has(value));
  });
}

export async function getAllStatusDefinitions(category?: string, client: any = prisma) {
  return client.requestStatusDefinition.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
  });
}

export async function getStatusDefinitionByCode(code: string, client: any = prisma) {
  return client.requestStatusDefinition.findUnique({ where: { code: normalizeStatusCode(code) } });
}

export async function assertSelectableStatusCode(code: string, client: any = prisma) {
  const normalized = normalizeStatusCode(code);
  const definition = await client.requestStatusDefinition.findUnique({ where: { code: normalized } });
  if (!definition) throw new AppError(`Status definition '${normalized}' does not exist`, 422);
  if (!definition.isActive || definition.retiredAt) {
    throw new AppError(`Status definition '${normalized}' is inactive or retired`, 422);
  }
  return definition;
}

export async function createStatusDefinition(input: StatusDefinitionInput, client: any = prisma) {
  const parsed = validateStatusDefinitionInput(input);
  const existing = await client.requestStatusDefinition.findUnique({ where: { code: parsed.code } });
  if (existing) throw new AppError(`Status definition with code '${parsed.code}' already exists`, 409);
  return client.requestStatusDefinition.create({ data: parsed });
}

export async function updateStatusDefinition(id: string, input: StatusDefinitionInput, client: any = prisma) {
  const existing = await client.requestStatusDefinition.findUnique({ where: { id } });
  if (!existing) throw new AppError('Status definition not found', 404);
  if (input.code !== undefined && normalizeStatusCode(input.code) !== existing.code) {
    throw new AppError('Status codes are immutable after creation; retire the old code and create a new one', 409);
  }
  const parsed = validateStatusDefinitionInput({
    code: existing.code,
    label: input.label ?? existing.label,
    description: input.description ?? existing.description,
    category: input.category ?? existing.category,
    displayOrder: input.displayOrder ?? existing.displayOrder,
    lifecycleType: input.lifecycleType ?? existing.lifecycleType,
    isActive: input.isActive ?? existing.isActive,
  }, false);
  const retiring = parsed.isActive === false || input.retiredAt !== undefined;
  return client.requestStatusDefinition.update({
    where: { id },
    data: {
      label: parsed.label,
      description: parsed.description,
      category: parsed.category,
      displayOrder: parsed.displayOrder,
      lifecycleType: parsed.lifecycleType,
      isActive: parsed.isActive,
      ...(retiring ? { retiredAt: input.retiredAt ? new Date(String(input.retiredAt)) : new Date() } : {}),
      ...(parsed.isActive && input.retiredAt === null ? { retiredAt: null } : {}),
    },
  });
}

export async function getStatusDefinitionUsage(id: string, client: any = prisma) {
  const definition = await client.requestStatusDefinition.findUnique({ where: { id }, select: { id: true, code: true } });
  if (!definition) throw new AppError('Status definition not found', 404);
  const [nodes, steps, transitionsFrom, transitionsTo, requests, historiesFrom, historiesTo, banners] = await Promise.all([
    client.workflowNode.count({ where: { statusCode: definition.code } }),
    client.workflowStep.count({ where: { status: definition.code } }),
    client.workflowTransition.count({ where: { fromStatus: definition.code } }),
    client.workflowTransition.count({ where: { toStatus: definition.code } }),
    client.request.count({ where: { status: definition.code } }),
    client.workflowHistory.count({ where: { fromStatus: definition.code } }),
    client.workflowHistory.count({ where: { toStatus: definition.code } }),
    client.bannerConfig.count({ where: { status: definition.code } }),
  ]);
  return {
    workflowNodes: nodes,
    workflowSteps: steps,
    transitionsFrom,
    transitionsTo,
    requests,
    historyFrom: historiesFrom,
    historyTo: historiesTo,
    banners,
    totalReferences: nodes + steps + transitionsFrom + transitionsTo + requests + historiesFrom + historiesTo + banners,
  };
}

export async function retireStatusDefinition(id: string, client: any = prisma) {
  const existing = await client.requestStatusDefinition.findUnique({ where: { id } });
  if (!existing) throw new AppError('Status definition not found', 404);
  return client.requestStatusDefinition.update({
    where: { id },
    data: { isActive: false, retiredAt: existing.retiredAt ?? new Date() },
  });
}

export async function deleteStatusDefinition(id: string, client: any = prisma) {
  const usage = await getStatusDefinitionUsage(id, client);
  if (usage.totalReferences > 0) {
    throw new AppError(`Cannot delete status definition: ${usage.totalReferences} reference(s) exist; retire it instead`, 409, usage);
  }
  return client.requestStatusDefinition.delete({ where: { id } });
}

export async function getStatusDefinitionForRuntime(code: string, client: any = prisma) {
  const normalized = normalizeStatusCode(code);
  const definition = await client.requestStatusDefinition.findUnique({ where: { code: normalized } });
  if (!definition) throw new AppError(`Status definition '${normalized}' does not exist`, 422);
  return definition;
}
