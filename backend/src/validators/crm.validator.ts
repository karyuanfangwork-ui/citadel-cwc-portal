import { z } from 'zod';

// ============================================================================
// SHARED
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const uuidParam = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// ACCOUNTS
// ============================================================================

const accountBodySchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().max(100).optional(),
  companySize: z.string().max(50).optional(),
  website: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  description: z.string().optional(),
  annualRevenue: z.coerce.number().nonnegative().optional(),
  // Malaysian-specific fields
  registrationNumber: z.string().max(50).optional(),
  taxNumber: z.string().max(50).optional(),
  bankAccount: z.string().max(100).optional(),
  purchaseCashTrust: z.coerce.boolean().optional(),
  accountType: z.enum(['INDIVIDUAL', 'CORPORATE']).default('CORPORATE'),
  ownerId: z.string().uuid().optional(),
  parentAccountId: z.string().uuid().optional().nullable(),
});

export const createAccountSchema = z.object({ body: accountBodySchema });

export const updateAccountSchema = z.object({ body: accountBodySchema.partial() });

export const accountFiltersSchema = paginationSchema.extend({
  industry: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  accountType: z.enum(['INDIVIDUAL', 'CORPORATE']).optional(),
});

// ============================================================================
// CONTACTS
// ============================================================================

const contactBodySchema = z.object({
  accountId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  jobTitle: z.string().max(150).optional(),
  department: z.string().max(100).optional(),
  isPrimary: z.coerce.boolean().default(false),
  description: z.string().optional(),
  // Phase 2 additions
  nricPassport: z.string().max(50).optional(),
  dateOfBirth: z.string().optional(),
  preferredLanguage: z.enum(['EN', 'BM', 'ZH']).optional(),
  pdpaConsent: z.coerce.boolean().optional(),
  pdpaConsentDate: z.string().optional(),
  marketingOptIn: z.coerce.boolean().optional(),
});

export const createContactSchema = z.object({ body: contactBodySchema });

export const updateContactSchema = z.object({ body: contactBodySchema.partial().omit({ accountId: true }) });

export const contactFiltersSchema = paginationSchema.extend({
  accountId: z.string().uuid().optional(),
});

// ============================================================================
// LEADS
// ============================================================================

const leadBodySchema = z.object({
  title: z.string().min(1).max(255),
  source: z.enum(['WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_SHOW', 'LINKEDIN', 'ADVERTISEMENT', 'PARTNER', 'WHATSAPP', 'OTHER']).default('OTHER'),
  accountId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().max(255).optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional(),
  companyName: z.string().max(255).optional(),
  estimatedValue: z.coerce.number().nonnegative().optional(),
  description: z.string().optional(),
});

export const createLeadSchema = z.object({ body: leadBodySchema });

export const updateLeadSchema = z.object({
  body: leadBodySchema.partial().extend({
    status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST']).optional(),
    lostReason: z.string().optional(),
    followUpDate: z.string().optional(),
    followUpNote: z.string().optional(),
  }),
});

export const leadFiltersSchema = paginationSchema.extend({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST']).optional(),
  source: z.enum(['WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_SHOW', 'LINKEDIN', 'ADVERTISEMENT', 'PARTNER', 'WHATSAPP', 'OTHER']).optional(),
  ownerId: z.string().uuid().optional(),
  followUpDate: z.string().optional(),
});

export const convertLeadSchema = z.object({
  body: z.object({
    opportunityName: z.string().min(1).max(255),
    pipelineId: z.string().uuid(),
    stageId: z.string().uuid(),
    value: z.coerce.number().nonnegative().default(0),
    expectedCloseDate: z.string().optional(), // ISO date
    createAccount: z.coerce.boolean().default(false),
    accountName: z.string().max(255).optional(),
  }),
});

// ============================================================================
// OPPORTUNITIES
// ============================================================================

const opportunityBodySchema = z.object({
  name: z.string().min(1).max(255),
  accountId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  value: z.coerce.number().nonnegative().default(0),
  currency: z.string().length(3).default('MYR'),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export const createOpportunitySchema = z.object({ body: opportunityBodySchema });

export const updateOpportunitySchema = z.object({ body: opportunityBodySchema.partial() });

export const moveOpportunityStageSchema = z.object({
  body: z.object({
    stageId: z.string().uuid(),
    lostReason: z.string().optional(),
  }),
});

export const opportunityFiltersSchema = paginationSchema.extend({
  accountId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
});

// ============================================================================
// PIPELINES
// ============================================================================

export const createPipelineSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    isDefault: z.coerce.boolean().default(false),
    stages: z.array(z.object({
      name: z.string().min(1).max(100),
      displayOrder: z.coerce.number().int().min(0),
      probability: z.coerce.number().int().min(0).max(100).default(0),
      color: z.string().max(20).default('#0052cc'),
      isWonStage: z.coerce.boolean().default(false),
      isLostStage: z.coerce.boolean().default(false),
    })).min(2), // At least 2 stages
  }),
});

export const updatePipelineSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

// ============================================================================
// ACTIVITIES
// ============================================================================

const activityBodySchema = z.object({
  activityType: z.enum(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT']),
  subject: z.string().min(1).max(255),
  description: z.string().optional(),
  accountId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  scheduledAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMinutes: z.coerce.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});

export const createActivitySchema = z.object({ body: activityBodySchema });

export const updateActivitySchema = z.object({ body: activityBodySchema.partial() });

export const activityFiltersSchema = paginationSchema.extend({
  activityType: z.enum(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT']).optional(),
  accountId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
});

// ============================================================================
// NOTES
// ============================================================================

export const createNoteSchema = z.object({
  body: z.object({
    content: z.string().min(1),
    accountId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    opportunityId: z.string().uuid().optional(),
    isPinned: z.coerce.boolean().default(false),
  }),
});

export const updateNoteSchema = z.object({
  body: z.object({
    content: z.string().min(1).optional(),
    isPinned: z.coerce.boolean().optional(),
  }),
});

// ============================================================================
// TRUST PRODUCTS
// ============================================================================

const trustProductBodySchema = z.object({
  trustType: z.enum(['LIVING_TRUST', 'TESTAMENTARY_TRUST', 'CHARITABLE_TRUST', 'CASH_TRUST']),
  accountId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  deedRefNumber: z.string().max(100).optional(),
  status: z.enum(['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'CLOSED']).default('ACTIVE'),
  assetValue: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).default('MYR'),
  assetDescription: z.string().optional(),
  trusteeName: z.string().max(200).optional(),
  trusteeContact: z.string().max(50).optional(),
  settlementDate: z.string().optional(),
  maturityDate: z.string().optional(),
  nextReviewDate: z.string().optional(),
});

export const createTrustProductSchema = z.object({ body: trustProductBodySchema });

export const updateTrustProductSchema = z.object({ body: trustProductBodySchema.partial() });

export const trustProductFiltersSchema = paginationSchema.extend({
  accountId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'CLOSED']).optional(),
});

export const updateTrustProductStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'CLOSED']),
  }),
});

// ============================================================================
// KYC RECORDS
// ============================================================================

export const upsertKycSchema = z.object({
  body: z.object({
    nricVerified: z.coerce.boolean().optional(),
    addressVerified: z.coerce.boolean().optional(),
    incomeVerified: z.coerce.boolean().optional(),
    sourceOfFundsVerified: z.coerce.boolean().optional(),
    riskProfileDone: z.coerce.boolean().optional(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    isPep: z.coerce.boolean().optional(),
    notes: z.string().optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
    rejectionReason: z.string().optional(),
  }),
});

// ============================================================================
// BENEFICIARIES
// ============================================================================

const beneficiaryBodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER']),
  allocationPct: z.coerce.number().min(0).max(100),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  nricPassport: z.string().max(50).optional(),
  dateOfBirth: z.string().optional(),
  isMinor: z.coerce.boolean().default(false),
  guardianName: z.string().max(200).optional(),
  notes: z.string().optional(),
});

export const createBeneficiarySchema = z.object({ body: beneficiaryBodySchema });

export const updateBeneficiarySchema = z.object({ body: beneficiaryBodySchema.partial() });

// ============================================================================
// IMPORT / EXPORT
// ============================================================================

export const importMappingSchema = z.object({
  body: z.object({
    columnMapping: z.record(z.string(), z.string()),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const importExecuteSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const exportRequestSchema = z.object({
  body: z.object({
    entity: z.enum(['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY']),
    filters: z.record(z.unknown()).optional(),
    format: z.enum(['CSV', 'XLSX']).default('CSV'),
  }),
});

// ======== TERRITORY & QUOTA ========

export const createTerritorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    regions: z.object({
      states: z.array(z.string()).optional(),
      countries: z.array(z.string()).optional(),
    }).optional(),
  }),
});

export const updateTerritorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().nullable().optional(),
    regions: z.object({
      states: z.array(z.string()).optional(),
      countries: z.array(z.string()).optional(),
    }).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const addTerritoryMemberSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    role: z.enum(['MANAGER', 'MEMBER']).default('MEMBER'),
  }),
});

export const createQuotaSchema = z.object({
  body: z.object({
    territoryId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    period: z.string().min(1),
    periodType: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).default('MONTHLY'),
    targetAmount: z.number().positive(),
    currency: z.string().max(3).default('MYR'),
  }),
});

export const updateQuotaSchema = z.object({
  body: z.object({
    period: z.string().min(1).optional(),
    periodType: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
    targetAmount: z.number().positive().optional(),
    currency: z.string().max(3).optional(),
  }),
});

// ============================================================================
// WORKFLOW AUTOMATION
// ============================================================================

export const createWorkflowSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
    trigger: z.object({
      event: z.string().min(1),
      conditions: z.array(z.object({
        field: z.string().min(1),
        op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in']),
        value: z.unknown(),
      })).optional(),
    }),
    actions: z.array(z.object({
      type: z.enum(['CREATE_TASK', 'SEND_NOTIFICATION', 'UPDATE_FIELD', 'REASSIGN_OWNER']),
      config: z.record(z.unknown()),
    })).min(1),
    executionOrder: z.number().int().default(0),
  }),
});

export const updateWorkflowSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    trigger: z.object({
      event: z.string().min(1),
      conditions: z.array(z.object({
        field: z.string().min(1),
        op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in']),
        value: z.unknown(),
      })).optional(),
    }).optional(),
    actions: z.array(z.object({
      type: z.enum(['CREATE_TASK', 'SEND_NOTIFICATION', 'UPDATE_FIELD', 'REASSIGN_OWNER']),
      config: z.record(z.unknown()),
    })).min(1).optional(),
    executionOrder: z.number().int().optional(),
  }),
});

// ── Custom Field Validators ──
export const createCustomFieldSchema = z.object({
  body: z.object({
    entity: z.enum(['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY', 'ACTIVITY']),
    fieldKey: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Must be a lowercase slug'),
    label: z.string().min(1).max(200),
    fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'URL']),
    group: z.string().max(100).optional(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    validation: z.object({
      required: z.boolean().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
    defaultValue: z.string().max(500).optional(),
    displayOrder: z.number().int().optional(),
    isSearchable: z.boolean().optional(),
    isRequired: z.boolean().optional(),
  }),
});

export const updateCustomFieldSchema = z.object({
  body: z.object({
    label: z.string().min(1).max(200).optional(),
    group: z.string().max(100).optional().nullable(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    validation: z.object({
      required: z.boolean().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
    defaultValue: z.string().max(500).optional().nullable(),
    displayOrder: z.number().int().optional(),
    isSearchable: z.boolean().optional(),
    isRequired: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});
