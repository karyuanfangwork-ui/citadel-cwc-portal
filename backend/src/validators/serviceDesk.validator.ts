import { z } from 'zod';

// P5-05: Conditional-field rule validation
const conditionSchema = z.object({
    fieldId: z.string().trim().min(1, 'Condition field is required'),
    operator: z.enum(['eq', 'neq', 'contains', 'startsWith', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty', 'in']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});

const conditionalRuleSchema = z.object({
    operator: z.enum(['and', 'or']).default('and'),
    conditions: z.array(conditionSchema).min(1, 'At least one condition is required'),
});

const formFieldSchema = z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    type: z.enum(['text', 'textarea', 'select', 'date', 'number', 'currency', 'file', 'entity', 'ceo-select', 'candidateDocuments']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
    showWhen: conditionalRuleSchema.optional(), // P5-05: conditional visibility
});

const formConfigSchema = z.array(formFieldSchema);

// P5-05: Export conditional rule schemas for reuse
export { conditionSchema, conditionalRuleSchema, formFieldSchema, formConfigSchema };

export const createServiceDeskSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
        code: z.string()
            .trim()
            .min(3, 'Code must be at least 3 characters')
            .max(20, 'Code must be at most 20 characters')
            .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
        description: z.string().trim().optional(),
        isActive: z.boolean().default(true),
        autoAssignTeam: z.string().trim().max(50).optional(),
        assignmentStrategy: z.enum(['ROUND_ROBIN', 'LEAST_LOADED', 'RANDOM', 'FIXED_AGENT']).default('ROUND_ROBIN'),
        autoAssignUserId: z.string().uuid().nullable().optional(),
    }),
});

export const updateServiceDeskSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name must be at most 100 characters').optional(),
        // code is intentionally excluded — desk code is immutable after creation
        // (hardcoded in business logic: IT workflow guards, reference number prefix, agentTeam matching)
        description: z.string().trim().optional(),
        isActive: z.boolean().optional(),
        autoAssignTeam: z.string().trim().max(50).optional(),
        assignmentStrategy: z.enum(['ROUND_ROBIN', 'LEAST_LOADED', 'RANDOM', 'FIXED_AGENT']).optional(),
        lastAssignedIndex: z.number().int().min(0).optional(),
        autoAssignUserId: z.string().uuid().nullable().optional(),
    }),
});

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
        description: z.string().trim().optional(),
        icon: z.string().trim().optional(),
        colorClass: z.string().trim().optional(),
        displayOrder: z.number().int().min(0, 'Display order must be non-negative').default(0),
        isActive: z.boolean().default(true),
    }),
});

export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name must be at most 100 characters').optional(),
        description: z.string().trim().optional(),
        icon: z.string().trim().optional(),
        colorClass: z.string().trim().optional(),
        displayOrder: z.number().int().min(0, 'Display order must be non-negative').optional(),
        isActive: z.boolean().optional(),
    }),
});

export const reorderCategoriesSchema = z.object({
    body: z.object({
        categoryIds: z.array(z.string().uuid('Invalid category ID')).min(1).max(500),
    }),
});

export const createRequestTypeSchema = z.object({
    body: z.object({
        categoryId: z.string().uuid('Invalid category ID'),
        name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be at most 150 characters'),
        description: z.string().trim().optional(),
        icon: z.string().trim().optional().default('bolt'),
        requiresApproval: z.boolean().default(false),
        slaHours: z.number().positive('SLA hours must be positive').optional(),
        requiredRole: z.string().trim().optional(),
        formConfig: formConfigSchema.optional(),
        // P5-01: Catalog governance fields
        ownerId: z.string().uuid('Invalid owner ID').optional(),
        lifecycleStatus: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED', 'RETIRED']).default('DRAFT'),
        reviewDate: z.string().datetime('Invalid review date').optional(),
    }),
});

export const updateRequestTypeSchema = z.object({
    body: z.object({
        categoryId: z.string().uuid('Invalid category ID').optional(),
        name: z.string().trim().min(1, 'Name cannot be empty').max(150, 'Name must be at most 150 characters').optional(),
        description: z.string().trim().optional(),
        icon: z.string().trim().optional(),
        requiresApproval: z.boolean().optional(),
        slaHours: z.number().positive('SLA hours must be positive').optional(),
        requiredRole: z.string().trim().optional(),
        formConfig: formConfigSchema.optional(),
        // P5-01: Catalog governance fields
        ownerId: z.string().uuid('Invalid owner ID').optional(),
        lifecycleStatus: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED', 'RETIRED']).optional(),
        reviewDate: z.string().datetime('Invalid review date').optional(),
    }),
});