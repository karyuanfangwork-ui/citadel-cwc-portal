import prisma from '../utils/prisma';

interface ResolveCustomFieldDisplayValuesInput {
  tenantId: string | null | undefined;
  customFields: unknown;
  formConfig: unknown;
}

interface CeoSelectField {
  id?: unknown;
  type?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asFields(value: unknown): CeoSelectField[] {
  if (Array.isArray(value)) return value as CeoSelectField[];
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as CeoSelectField[] : [];
  } catch {
    return [];
  }
}

const DISPLAY_ROLE: Record<string, string> = {
  CEO: 'CEO',
  GROUP_DCEO: 'Group Deputy CEO',
};

/**
 * Resolve selected executive IDs for request-detail display only. The saved
 * custom-field IDs remain untouched and lookups are restricted to the request
 * tenant. Inactive historical approvers remain resolvable for old tickets.
 */
export async function resolveCustomFieldDisplayValues({
  tenantId,
  customFields,
  formConfig,
}: ResolveCustomFieldDisplayValuesInput): Promise<Record<string, string>> {
  const values = asRecord(customFields);
  const approverIdsByField = new Map<string, string>();

  for (const field of asFields(formConfig)) {
    if (field.type !== 'ceo-select' || typeof field.id !== 'string') continue;
    const value = values[field.id];
    const approverId = typeof value === 'string' ? value.trim() : '';
    if (approverId) approverIdsByField.set(field.id, approverId);
  }

  if (approverIdsByField.size === 0) return {};
  const displayById = new Map<string, string>();

  if (tenantId) {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        id: { in: [...new Set(approverIdsByField.values())] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
        executiveRole: true,
        roles: {
          where: { role: { name: { in: ['CEO', 'GROUP_DCEO'] } } },
          select: { role: { select: { name: true } } },
        },
      },
    });

    for (const user of users) {
      const role = user.executiveRole
        || user.roles.find(({ role }) => role.name === 'CEO' || role.name === 'GROUP_DCEO')?.role.name
        || '';
      const name = `${user.firstName} ${user.lastName}`.trim() || 'Unnamed approver';
      const roleLabel = DISPLAY_ROLE[role] ?? role;
      displayById.set(
        user.id,
        `${name}${roleLabel ? ` — ${roleLabel}` : ''}${user.isActive ? '' : ' (inactive)'}`,
      );
    }
  }

  return Object.fromEntries(
    [...approverIdsByField].map(([fieldId, approverId]) => [
      fieldId,
      displayById.get(approverId) ?? 'Unavailable approver',
    ]),
  );
}
