
import prisma from '../utils/prisma';

// ============================================================================
// CUSTOM FIELDS SERVICE
// - CRUD for field definitions
// - Validation of custom field values against definitions
// - Dynamic filtering support
// ============================================================================

type EntityType = 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY' | 'ACTIVITY';

export async function getDefinitions(entity?: EntityType) {
  const where = entity ? { entity, isActive: true } : { isActive: true };
  return prisma.crmCustomFieldDefinition.findMany({
    where,
    orderBy: [{ entity: 'asc' }, { displayOrder: 'asc' }],
  });
}

export async function getDefinitionsByEntity(entity: EntityType) {
  return prisma.crmCustomFieldDefinition.findMany({
    where: { entity, isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
}

export async function createDefinition(data: {
  entity: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  group?: string;
  options?: any;
  validation?: any;
  defaultValue?: string;
  displayOrder?: number;
  isSearchable?: boolean;
  isRequired?: boolean;
}) {
  // Validate fieldType
  const validTypes = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'URL'];
  if (!validTypes.includes(data.fieldType)) {
    throw new Error(`Invalid fieldType: ${data.fieldType}. Must be one of: ${validTypes.join(', ')}`);
  }
  // Validate entity
  const validEntities = ['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY', 'ACTIVITY'];
  if (!validEntities.includes(data.entity)) {
    throw new Error(`Invalid entity: ${data.entity}. Must be one of: ${validEntities.join(', ')}`);
  }
  // Validate fieldKey (slug format)
  if (!/^[a-z][a-z0-9_]*$/.test(data.fieldKey)) {
    throw new Error('fieldKey must be a lowercase slug (letters, numbers, underscores, starting with a letter)');
  }

  return prisma.crmCustomFieldDefinition.create({
    data: {
      entity: data.entity,
      fieldKey: data.fieldKey,
      label: data.label,
      fieldType: data.fieldType,
      group: data.group || null,
      options: data.options || undefined,
      validation: data.validation || undefined,
      defaultValue: data.defaultValue || null,
      displayOrder: data.displayOrder || 0,
      isSearchable: data.isSearchable || false,
      isRequired: data.isRequired || false,
    },
  });
}

export async function updateDefinition(id: string, data: {
  label?: string;
  group?: string;
  options?: any;
  validation?: any;
  defaultValue?: string;
  displayOrder?: number;
  isSearchable?: boolean;
  isRequired?: boolean;
  isActive?: boolean;
}) {
  return prisma.crmCustomFieldDefinition.update({ where: { id }, data });
}

export async function deleteDefinition(id: string) {
  return prisma.crmCustomFieldDefinition.update({ where: { id }, data: { isActive: false } });
}

export async function permanentlyDeleteDefinition(id: string) {
  return prisma.crmCustomFieldDefinition.delete({ where: { id } });
}

// Validate custom field values against definitions
export async function validateCustomFields(entity: EntityType, customFields: Record<string, any> | null | undefined): Promise<{ valid: boolean; errors: string[] }> {
  if (!customFields) return { valid: true, errors: [] };

  const definitions = await getDefinitionsByEntity(entity);
  const errors: string[] = [];

  for (const def of definitions) {
    const value = customFields[def.fieldKey];

    // Check required
    if (def.isRequired && (value === undefined || value === null || value === '')) {
      errors.push(`${def.label} is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    const validation = def.validation as any;
    if (!validation) continue;

    // Check validation rules
    if (validation.required && (value === '' || value === null)) {
      errors.push(`${def.label} is required`);
    }
    if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
      errors.push(`${def.label} must be at least ${validation.min}`);
    }
    if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
      errors.push(`${def.label} must be at most ${validation.max}`);
    }
    if (validation.pattern && typeof value === 'string' && !new RegExp(validation.pattern).test(value)) {
      errors.push(`${def.label} does not match required format`);
    }

    // Type-specific validation
    if (def.fieldType === 'DROPDOWN' || def.fieldType === 'MULTI_SELECT') {
      const opts = def.options as any[];
      if (Array.isArray(opts)) {
        const validValues = opts.map(o => o.value);
        if (def.fieldType === 'DROPDOWN' && !validValues.includes(value)) {
          errors.push(`${def.label}: invalid value "${value}"`);
        }
        if (def.fieldType === 'MULTI_SELECT' && Array.isArray(value)) {
          for (const v of value) {
            if (!validValues.includes(v)) {
              errors.push(`${def.label}: invalid value "${v}"`);
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Build Prisma filter for custom fields in list queries
export function buildCustomFieldFilter(_entity: EntityType, filters: Record<string, any>): any {
  const conditions: any[] = [];

  for (const [key, value] of Object.entries(filters)) {
    conditions.push({
      customFields: { path: [key], equals: value },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export default {
  getDefinitions,
  getDefinitionsByEntity,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  permanentlyDeleteDefinition,
  validateCustomFields,
  buildCustomFieldFilter,
};