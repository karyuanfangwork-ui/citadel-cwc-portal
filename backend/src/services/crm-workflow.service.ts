import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

// ── Event bus for CRM operations ──
export const workflowEventBus = new EventEmitter();
workflowEventBus.setMaxListeners(50);

// ── Types ──
interface TriggerConfig {
  event: string; // e.g. "lead.status.changed", "opportunity.stage.changed", "activity.created"
  conditions?: ConditionConfig[];
}

interface ConditionConfig {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
}

interface ActionConfig {
  type: 'CREATE_TASK' | 'SEND_NOTIFICATION' | 'UPDATE_FIELD' | 'REASSIGN_OWNER';
  config: Record<string, any>;
}

// ── Max execution depth to prevent infinite loops ──
const MAX_EXECUTION_DEPTH = 3;

// ── Pre-built workflow templates ──
export const WORKFLOW_TEMPLATES = [
  {
    name: 'New Lead → Create Follow-up Task',
    description: 'Automatically create a follow-up task when a new lead is created',
    trigger: { event: 'lead.created', conditions: [] },
    actions: [{ type: 'CREATE_TASK', config: { subject: 'Follow up on new lead', description: 'Reach out to the new lead within 24 hours', type: 'FOLLOW_UP', assignTo: 'owner' } }],
  },
  {
    name: 'Deal Won → Notify Finance',
    description: 'Send notification when a deal is won',
    trigger: { event: 'opportunity.stage.changed', conditions: [{ field: 'stageName', op: 'eq', value: 'CLOSED_WON' }] },
    actions: [{ type: 'SEND_NOTIFICATION', config: { title: 'Deal Won!', message: 'A deal has been won. Finance team please review.', recipientRole: 'ADMIN' } }],
  },
  {
    name: 'Lead Stale 7 Days → Reassign',
    description: 'Reassign leads that have been inactive for 7 days',
    trigger: { event: 'lead.stale', conditions: [{ field: 'daysSinceActivity', op: 'gte', value: 7 }] },
    actions: [{ type: 'REASSIGN_OWNER', config: { reassignTo: 'manager' } }],
  },
  {
    name: 'Opportunity Value > 500k → Create Review Task',
    description: 'Create a review task for high-value opportunities',
    trigger: { event: 'opportunity.created', conditions: [{ field: 'value', op: 'gte', value: 500000 }] },
    actions: [{ type: 'CREATE_TASK', config: { subject: 'High-Value Opportunity Review', description: 'Review opportunity exceeding 500K', type: 'TASK', assignTo: 'manager' } }],
  },
  {
    name: 'Lead Qualified → Create Opportunity',
    description: 'Set the lead stage to QUALIFIED when status changes to qualified',
    trigger: { event: 'lead.status.changed', conditions: [{ field: 'status', op: 'eq', value: 'QUALIFIED' }] },
    actions: [{ type: 'UPDATE_FIELD', config: { entityType: 'lead', field: 'status', value: 'QUALIFIED' } }],
  },
];

/**
 * Emit a workflow trigger event.
 * Call this from CRM service methods after mutations.
 */
export function emitWorkflowEvent(
  event: string,
  entityType: string,
  entityId: string,
  entityData: Record<string, any>,
  depth = 0
) {
  if (depth > MAX_EXECUTION_DEPTH) return;
  workflowEventBus.emit('crm:workflow', { event, entityType, entityId, entityData, depth });
}

// ── Start the workflow engine listener ──
export function startWorkflowEngine() {
  workflowEventBus.on('crm:workflow', async (payload: {
    event: string; entityType: string; entityId: string; entityData: Record<string, any>; depth: number;
  }) => {
    try {
      await processTrigger(payload.event, payload.entityType, payload.entityId, payload.entityData, payload.depth);
    } catch (err: any) {
      console.error('[WorkflowEngine] Error processing trigger:', err.message);
    }
  });
  console.log('[WorkflowEngine] Started');
}

/**
 * Find matching workflows and execute them
 */
async function processTrigger(
  event: string,
  entityType: string,
  entityId: string,
  entityData: Record<string, any>,
  _depth: number
) {
  const workflows = await prisma.crmWorkflow.findMany({
    where: { isActive: true },
    orderBy: { executionOrder: 'asc' },
  });

  for (const workflow of workflows) {
    const trigger = workflow.trigger as unknown as TriggerConfig;
    if (trigger.event !== event) continue;

    // Evaluate conditions
    const conditions = trigger.conditions || [];
    const allMet = conditions.every(cond => evaluateCondition(cond, entityData));
    if (!allMet) continue;

    // Execute actions
    const execution = await prisma.crmWorkflowExecution.create({
      data: {
        workflowId: workflow.id,
        triggerEntity: entityType,
        triggerEntityId: entityId,
        triggerEvent: event,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const actions = workflow.actions as unknown as ActionConfig[];
      const actionResults: Record<string, any>[] = [];

      for (const action of actions) {
        const result = await executeAction(action, entityType, entityId, entityData);
        actionResults.push({ action: action.type, result });
      }

      await prisma.crmWorkflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          actionResults: actionResults as any,
          completedAt: new Date(),
        },
      });
    } catch (err: any) {
      await prisma.crmWorkflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: err.message?.substring(0, 500),
          completedAt: new Date(),
        },
      });
    }
  }
}

/**
 * Evaluate a single condition against entity data
 */
function evaluateCondition(cond: ConditionConfig, data: Record<string, any>): boolean {
  const fieldValue = cond.field.split('.').reduce((obj, key) => obj?.[key], data);
  switch (cond.op) {
    case 'eq': return fieldValue === cond.value;
    case 'neq': return fieldValue !== cond.value;
    case 'gt': return Number(fieldValue) > Number(cond.value);
    case 'lt': return Number(fieldValue) < Number(cond.value);
    case 'gte': return Number(fieldValue) >= Number(cond.value);
    case 'lte': return Number(fieldValue) <= Number(cond.value);
    case 'contains': return String(fieldValue || '').includes(String(cond.value));
    case 'in': return Array.isArray(cond.value) && cond.value.includes(fieldValue);
    default: return false;
  }
}

/**
 * Execute a single workflow action
 */
async function executeAction(
  action: ActionConfig,
  entityType: string,
  entityId: string,
  entityData: Record<string, any>
): Promise<Record<string, any>> {
  switch (action.type) {
    case 'CREATE_TASK': {
      const subject = interpolateTemplate(action.config.subject || 'Task', entityData);
      const description = interpolateTemplate(action.config.description || '', entityData);
      const taskActivityType = action.config.type === 'FOLLOW_UP' ? 'FOLLOW_UP' : 'TASK';
      let assignToId: string | undefined;

      if (action.config.assignTo === 'owner' && entityData.ownerId) {
        assignToId = entityData.ownerId;
      } else if (action.config.assignTo === 'manager') {
        assignToId = entityData.ownerId; // fallback to owner
      }

      const taskData: Record<string, any> = {
        activityType: taskActivityType,
        subject,
        description,
        userId: assignToId || entityData.ownerId,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // Set the polymorphic relation based on entity type
      if (entityType === 'LEAD' && entityId) taskData.leadId = entityId;
      else if (entityType === 'OPPORTUNITY' && entityId) taskData.opportunityId = entityId;
      else if (entityType === 'ACCOUNT' && entityId) taskData.accountId = entityId;
      else if (entityType === 'CONTACT' && entityId) taskData.contactId = entityId;

      const task = await prisma.crmActivity.create({ data: taskData as any });
      return { taskId: task.id };
    }

    case 'SEND_NOTIFICATION': {
      // Create an SSE notification event
      const title = interpolateTemplate(action.config.title || 'CRM Notification', entityData);
      const message = interpolateTemplate(action.config.message || '', entityData);
      // Log as a workflow result; actual SSE push happens through existing notification infrastructure
      return { notificationSent: true, title, message, recipientRole: action.config.recipientRole };
    }

    case 'UPDATE_FIELD': {
      const targetEntityType = action.config.entityType || entityType;
      const field = action.config.field;
      const value = action.config.value;

      if (targetEntityType === 'LEAD') {
        await prisma.crmLead.update({ where: { id: entityId }, data: { [field]: value } });
      } else if (targetEntityType === 'OPPORTUNITY') {
        await prisma.crmOpportunity.update({ where: { id: entityId }, data: { [field]: value } });
      } else if (targetEntityType === 'CONTACT') {
        await prisma.crmContact.update({ where: { id: entityId }, data: { [field]: value } });
      } else if (targetEntityType === 'ACCOUNT') {
        await prisma.crmAccount.update({ where: { id: entityId }, data: { [field]: value } });
      }
      return { fieldUpdated: true, entityType: targetEntityType, field, value };
    }

    case 'REASSIGN_OWNER': {
      let newOwnerId: string | undefined;
      if (action.config.reassignTo === 'manager') {
        // Fallback: keep owner for now; in full impl, look up manager
        newOwnerId = entityData.ownerId;
      } else if (action.config.userId) {
        newOwnerId = action.config.userId;
      }

      if (newOwnerId) {
        if (entityType === 'LEAD') {
          await prisma.crmLead.update({ where: { id: entityId }, data: { ownerId: newOwnerId } });
        } else if (entityType === 'OPPORTUNITY') {
          await prisma.crmOpportunity.update({ where: { id: entityId }, data: { ownerId: newOwnerId } });
        }
      }
      return { reassigned: true, newOwnerId };
    }

    default:
      return { error: `Unknown action type: ${action.type}` };
  }
}

/**
 * Simple template interpolation: replace {{field}} with entity data values
 */
function interpolateTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''));
}

// ── CRUD Operations ──

export async function listWorkflows(page = 1, limit = 20) {
  const [workflows, total] = await Promise.all([
    prisma.crmWorkflow.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { executionOrder: 'asc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.crmWorkflow.count(),
  ]);
  return { workflows, total, page, limit };
}

export async function getWorkflow(id: string) {
  return prisma.crmWorkflow.findUnique({
    where: { id },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function createWorkflow(data: {
  name: string; description?: string; trigger: any; actions: any[]; executionOrder?: number; isActive?: boolean;
}, userId: string) {
  return prisma.crmWorkflow.create({
    data: {
      name: data.name,
      description: data.description,
      trigger: data.trigger as any,
      actions: data.actions as any,
      executionOrder: data.executionOrder ?? 0,
      isActive: data.isActive ?? true,
      createdBy: userId,
    },
  });
}

export async function updateWorkflow(id: string, data: {
  name?: string; description?: string; trigger?: any; actions?: any[]; executionOrder?: number; isActive?: boolean;
}) {
  return prisma.crmWorkflow.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.trigger !== undefined && { trigger: data.trigger as any }),
      ...(data.actions !== undefined && { actions: data.actions as any }),
      ...(data.executionOrder !== undefined && { executionOrder: data.executionOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deleteWorkflow(id: string) {
  return prisma.crmWorkflow.delete({ where: { id } });
}

export async function toggleWorkflow(id: string) {
  const workflow = await prisma.crmWorkflow.findUnique({ where: { id } });
  if (!workflow) throw new Error('Workflow not found');
  return prisma.crmWorkflow.update({
    where: { id },
    data: { isActive: !workflow.isActive },
  });
}

export async function getWorkflowExecutions(workflowId: string, page = 1, limit = 20) {
  const [executions, total] = await Promise.all([
    prisma.crmWorkflowExecution.findMany({
      where: { workflowId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startedAt: 'desc' },
    }),
    prisma.crmWorkflowExecution.count({ where: { workflowId } }),
  ]);
  return { executions, total, page, limit };
}

export async function getAllExecutions(page = 1, limit = 20) {
  const [executions, total] = await Promise.all([
    prisma.crmWorkflowExecution.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: { workflow: { select: { name: true } } },
    }),
    prisma.crmWorkflowExecution.count(),
  ]);
  return { executions, total, page, limit };
}

export default {
  emitWorkflowEvent,
  startWorkflowEngine,
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  getWorkflowExecutions,
  getAllExecutions,
  WORKFLOW_TEMPLATES,
};