import { z } from 'zod';

// P5-05: Conditional-field rule validation
const conditionSchema = z.object({
    fieldId: z.string(), // Allow empty strings — frontend builds rules incrementally; invalid ones are stripped before persisting
    operator: z.enum(['eq', 'neq', 'contains', 'startsWith', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty', 'in']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});

const conditionalRuleSchema = z.object({
    operator: z.enum(['and', 'or']).default('and'),
    conditions: z.array(conditionSchema), // Allow empty array — incomplete rules are stripped before persisting
});

const formFieldSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
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
        name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
        code: z.string()
            .min(3, 'Code must be at least 3 characters')
            .max(20, 'Code must be at most 20 characters')
            .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
        autoAssignTeam: z.string().max(50).optional(),
        assignmentStrategy: z.enum(['ROUND_ROBIN', 'LEAST_LOADED', 'RANDOM']).default('ROUND_ROBIN'),
    }),
});

export const updateServiceDeskSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name cannot be empty').max(100, 'Name must be at most 100 characters').optional(),
        // code is intentionally excluded — desk code is immutable after creation
        // (hardcoded in business logic: IT workflow guards, reference number prefix, agentTeam matching)
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        autoAssignTeam: z.string().max(50).optional(),
        assignmentStrategy: z.enum(['ROUND_ROBIN', 'LEAST_LOADED', 'RANDOM']).optional(),
        lastAssignedIndex: z.number().int().min(0).optional(),
    }),
});

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
        description: z.string().optional(),
        icon: z.string().optional(),
        colorClass: z.string().optional(),
        displayOrder: z.number().default(0),
        isActive: z.boolean().default(true),
    }),
});

export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name cannot be empty').max(100, 'Name must be at most 100 characters').optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        colorClass: z.string().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
    }),
});

export const createRequestTypeSchema = z.object({
    body: z.object({
        categoryId: z.string().uuid('Invalid category ID'),
        name: z.string().min(1, 'Name is required').max(150, 'Name must be at most 150 characters'),
        description: z.string().optional(),
        icon: z.string().default('bolt'),
        requiresApproval: z.boolean().default(false),
        slaHours: z.number().positive('SLA hours must be positive').optional(),
        requiredRole: z.string().optional(),
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
        name: z.string().min(1, 'Name cannot be empty').max(150, 'Name must be at most 150 characters').optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        requiresApproval: z.boolean().optional(),
        slaHours: z.number().positive('SLA hours must be positive').optional(),
        requiredRole: z.string().optional(),
        formConfig: formConfigSchema.optional(),
        // P5-01: Catalog governance fields
        ownerId: z.string().uuid('Invalid owner ID').optional(),
        lifecycleStatus: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED', 'RETIRED']).optional(),
        reviewDate: z.string().datetime('Invalid review date').optional(),
    }),
});