/**
 * Fail-closed planning for bootstrapping workflow-scoped authoring graphs.
 *
 * This planner never writes. It turns legacy WorkflowStep rows, canonical
 * transition definitions, global runtime policy rows, and live occupancy into
 * a reviewable candidate graph. A separate, explicitly approved command may
 * later persist a plan after all blocking findings are resolved.
 */

import { randomUUID } from 'crypto';

import { GraphEdge, GraphNode, WorkflowGraph } from './workflowGraph.types';

export interface BootstrapStep {
  status: string;
  label: string;
  icon: string;
  displayOrder: number;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
}

export interface BootstrapTransitionDefinition {
  fromStatus: string;
  toStatus: string;
  transitionLabel: string;
  requiresComment: boolean;
}

export interface BootstrapRuntimePolicy {
  fromStatus: string;
  toStatus: string;
  transitionLabel: string | null;
  requiresComment: boolean;
  autoAssignRole: string | null;
  autoAssignUserId: string | null;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
  isActive: boolean;
}

export type BootstrapIssueCode =
  | 'MISSING_RUNTIME_POLICY'
  | 'UNSAFE_EMPTY_RUNTIME_POLICY'
  | 'CONFLICTING_RUNTIME_POLICY'
  | 'SYNTHETIC_SEQUENTIAL_EDGE'
  | 'SYNTHETIC_CANCEL_EDGE'
  | 'OCCUPIED_STATUS_NOT_CANONICAL'
  | 'OCCUPIED_STATUS_NO_EXIT'
  | 'CANONICAL_STATUS_NOT_IN_STEPS';

export interface BootstrapIssue {
  code: BootstrapIssueCode;
  severity: 'BLOCKING' | 'WARNING';
  message: string;
  fromStatus?: string;
  toStatus?: string;
  status?: string;
}

export interface BootstrapPlan {
  graph: WorkflowGraph;
  addedNodeStatuses: string[];
  addedEdges: Array<{ fromStatus: string; toStatus: string; source: 'CANONICAL' | 'SEQUENTIAL' | 'CANCEL' }>;
  issues: BootstrapIssue[];
}

export const CANCELABLE_STATUSES: Record<string, string[]> = {
  IT_SIMPLE: ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'ACTION_REQUIRED', 'WAITING'],
};

const APPROVED_CANCELLATION_POLICY = {
  workflowCode: 'IT_SIMPLE',
  allowedRoles: ['AGENT', 'ADMIN'],
  requiresComment: true,
};

const key = (fromStatus: string, toStatus: string): string => `${fromStatus}\u0000${toStatus}`;

const EXPLICIT_ROLE_POLICIES: Record<string, string[]> = {
  CEO_APPROVED: ['CEO'],
  CEO_REJECTED: ['CEO'],
  CEO_APPROVED_IT: ['CEO'],
  CEO_REJECTED_IT: ['CEO'],
  CTO_APPROVED_IT: ['CTO'],
  CTO_REJECTED_IT: ['CTO'],
  CFO_APPROVED_FIN: ['CFO'],
  CFO_REJECTED_FIN: ['CFO'],
  CFO_APPROVED_IT: ['CFO'],
  CFO_REJECTED_IT: ['CFO'],
  GROUP_DCEO_APPROVED: ['GROUP_DCEO'],
  GROUP_DCEO_REJECTED: ['GROUP_DCEO'],
  MANAGER_APPROVED_FIN: ['MANAGER'],
  MANAGER_REJECTED_FIN: ['MANAGER'],
  FINANCE_HEAD_APPROVED: ['FINANCE_HEAD', 'CFO'],
  FINANCE_HEAD_REJECTED: ['FINANCE_HEAD', 'CFO'],
  LOA_APPROVED: ['HIRING_MANAGER'],
};

const requiresExplicitPolicy = (toStatus: string): boolean => (
  Object.prototype.hasOwnProperty.call(EXPLICIT_ROLE_POLICIES, toStatus)
);

const policyToEdge = (policy: BootstrapRuntimePolicy, fromNodeId: string, toNodeId: string, id = randomUUID()): GraphEdge => ({
  id,
  fromNodeId,
  toNodeId,
  transitionLabel: policy.transitionLabel,
  requiresComment: policy.requiresComment,
  autoAssignRole: policy.autoAssignRole,
  autoAssignUserId: policy.autoAssignUserId,
  allowedRoles: [...policy.allowedRoles],
  allowedExecutiveRoles: [...policy.allowedExecutiveRoles],
});

const definitionToEdge = (
  definition: BootstrapTransitionDefinition,
  fromNodeId: string,
  toNodeId: string,
): GraphEdge => ({
  id: randomUUID(),
  fromNodeId,
  toNodeId,
  transitionLabel: definition.transitionLabel,
  requiresComment: definition.requiresComment,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: [],
  allowedExecutiveRoles: [],
});

export function planCanonicalBootstrap(input: {
  workflowCode: string;
  current: WorkflowGraph;
  steps: BootstrapStep[];
  definitions: BootstrapTransitionDefinition[];
  globalPolicies: BootstrapRuntimePolicy[];
  occupiedStatuses: string[];
}): BootstrapPlan {
  const { workflowCode, current, steps, definitions, globalPolicies, occupiedStatuses } = input;
  const issues: BootstrapIssue[] = [];
  const stepStatuses = new Set(steps.map((step) => step.status));
  const statuses = new Set(stepStatuses);
  const currentByStatus = new Map(current.nodes.map((node) => [node.statusCode, node]));
  const currentEdgeByKey = new Map<string, GraphEdge>();

  for (const edge of current.edges) {
    const fromStatus = current.nodes.find((node) => node.id === edge.fromNodeId)?.statusCode;
    const toStatus = current.nodes.find((node) => node.id === edge.toNodeId)?.statusCode;
    if (fromStatus && toStatus) currentEdgeByKey.set(key(fromStatus, toStatus), edge);
  }

  const policyByKey = new Map<string, BootstrapRuntimePolicy[]>();
  for (const policy of globalPolicies.filter((row) => row.isActive)) {
    const policyKey = key(policy.fromStatus, policy.toStatus);
    policyByKey.set(policyKey, [...(policyByKey.get(policyKey) ?? []), policy]);
  }

  const plannedDefinitions = definitions.filter((definition) => stepStatuses.has(definition.fromStatus));
  for (const definition of plannedDefinitions) statuses.add(definition.toStatus);
  for (const status of occupiedStatuses) {
    statuses.add(status);
    if (!stepStatuses.has(status) && !plannedDefinitions.some((definition) => definition.toStatus === status)) {
      issues.push({
        code: 'OCCUPIED_STATUS_NOT_CANONICAL',
        severity: 'BLOCKING',
        status,
        message: `${workflowCode} has live requests in ${status}, but the status is not in the canonical workflow definition`,
      });
    }
  }

  const plannedPairs = new Set<string>();
  const plannedDefinitionsWithSource: Array<{ definition: BootstrapTransitionDefinition; source: 'CANONICAL' | 'SEQUENTIAL' | 'CANCEL' }> = [];

  for (const definition of plannedDefinitions) {
    const transitionKey = key(definition.fromStatus, definition.toStatus);
    if (plannedPairs.has(transitionKey)) continue;
    plannedPairs.add(transitionKey);
    plannedDefinitionsWithSource.push({ definition, source: 'CANONICAL' });
  }

  for (let index = 1; index < steps.length; index += 1) {
    const definition: BootstrapTransitionDefinition = {
      fromStatus: steps[index - 1].status,
      toStatus: steps[index].status,
      transitionLabel: 'ADVANCE',
      requiresComment: false,
    };
    if (
      definition.toStatus === 'CANCELLED'
      && workflowCode === APPROVED_CANCELLATION_POLICY.workflowCode
    ) continue;
    const transitionKey = key(definition.fromStatus, definition.toStatus);
    if (plannedPairs.has(transitionKey)) continue;
    plannedPairs.add(transitionKey);
    plannedDefinitionsWithSource.push({ definition, source: 'SEQUENTIAL' });
    issues.push({
      code: 'SYNTHETIC_SEQUENTIAL_EDGE',
      severity: 'BLOCKING',
      fromStatus: definition.fromStatus,
      toStatus: definition.toStatus,
      message: `${workflowCode} requires a synthetic sequential edge ${definition.fromStatus} → ${definition.toStatus}; approve this edge explicitly before writing`,
    });
  }

  if (occupiedStatuses.includes('CANCELLED')) {
    for (const fromStatus of CANCELABLE_STATUSES[workflowCode] ?? []) {
      if (!statuses.has(fromStatus)) continue;
      const definition: BootstrapTransitionDefinition = {
        fromStatus,
        toStatus: 'CANCELLED',
        transitionLabel: 'CANCEL',
        requiresComment: false,
      };
      const transitionKey = key(fromStatus, 'CANCELLED');
      if (plannedPairs.has(transitionKey)) continue;
      plannedPairs.add(transitionKey);
      statuses.add('CANCELLED');
      plannedDefinitionsWithSource.push({ definition, source: 'CANCEL' });
      if (workflowCode !== APPROVED_CANCELLATION_POLICY.workflowCode) {
        issues.push({
          code: 'SYNTHETIC_CANCEL_EDGE',
          severity: 'BLOCKING',
          fromStatus,
          toStatus: 'CANCELLED',
          message: `${workflowCode} needs an explicit reviewed cancellation edge ${fromStatus} → CANCELLED`,
        });
      }
    }
  }

  for (const [transitionKey, policies] of policyByKey) {
    if (policies.length > 1) {
      const fingerprints = new Set(policies.map((policy) => JSON.stringify(policy)));
      if (fingerprints.size > 1) {
        const [fromStatus, toStatus] = transitionKey.split('\u0000');
        issues.push({
          code: 'CONFLICTING_RUNTIME_POLICY',
          severity: 'BLOCKING',
          fromStatus,
          toStatus,
          message: `${workflowCode} has conflicting global runtime policy rows for ${fromStatus} → ${toStatus}`,
        });
      }
    }
  }

  const stepByStatus = new Map(steps.map((step) => [step.status, step]));
  const outgoing = new Set(plannedDefinitionsWithSource.map(({ definition }) => definition.fromStatus));
  const maxDisplayOrder = steps.reduce((max, step) => Math.max(max, step.displayOrder), 0);
  const nodes: GraphNode[] = [...statuses].map((status, index) => {
    const existing = currentByStatus.get(status);
    const step = stepByStatus.get(status);
    const hasIncoming = plannedDefinitionsWithSource.some(({ definition }) => definition.toStatus === status);
    const isTerminal = !outgoing.has(status) && hasIncoming;
    return existing ?? {
      id: randomUUID(),
      type: 'STATUS',
      statusCode: status,
      label: step?.label ?? status,
      displayOrder: step?.displayOrder ?? maxDisplayOrder + index + 1,
      positionX: null,
      positionY: null,
      isInitial: step?.isInitial ?? false,
      isFinal: step?.isFinal ?? isTerminal,
      slaPause: step?.slaPause ?? false,
      icon: step?.icon ?? (isTerminal ? 'check_circle' : 'radio_button_checked'),
    };
  });

  const nodeByStatus = new Map(nodes.map((node) => [node.statusCode, node]));
  const edges: GraphEdge[] = [...current.edges];
  const existingPairs = new Set(currentEdgeByKey.keys());
  const addedEdges: BootstrapPlan['addedEdges'] = [];

  for (const { definition, source } of plannedDefinitionsWithSource) {
    const transitionKey = key(definition.fromStatus, definition.toStatus);
    if (existingPairs.has(transitionKey)) continue;
    const fromNode = nodeByStatus.get(definition.fromStatus);
    const toNode = nodeByStatus.get(definition.toStatus);
    if (!fromNode || !toNode) continue;

    const policies = policyByKey.get(transitionKey) ?? [];
    let edge: GraphEdge;
    if (policies.length > 0) {
      edge = policyToEdge(policies[0], fromNode.id, toNode.id);
      if (
        requiresExplicitPolicy(definition.toStatus)
        && edge.allowedRoles.length === 0
        && edge.allowedExecutiveRoles.length === 0
      ) {
        issues.push({
          code: 'UNSAFE_EMPTY_RUNTIME_POLICY',
          severity: 'BLOCKING',
          fromStatus: definition.fromStatus,
          toStatus: definition.toStatus,
          message: `${workflowCode} has an empty authorization policy for ${definition.fromStatus} → ${definition.toStatus}; approval roles must be explicit`,
        });
      }
    } else {
      edge = definitionToEdge(definition, fromNode.id, toNode.id);
      const recommendedRoles = EXPLICIT_ROLE_POLICIES[definition.toStatus];
      if (recommendedRoles) {
        edge.allowedRoles = [...recommendedRoles];
      } else if (
        definition.toStatus === 'CANCELLED'
        && workflowCode === APPROVED_CANCELLATION_POLICY.workflowCode
      ) {
        edge.allowedRoles = [...APPROVED_CANCELLATION_POLICY.allowedRoles];
        edge.requiresComment = APPROVED_CANCELLATION_POLICY.requiresComment;
      } else {
        issues.push({
          code: 'MISSING_RUNTIME_POLICY',
          severity: 'BLOCKING',
          fromStatus: definition.fromStatus,
          toStatus: definition.toStatus,
          message: `${workflowCode} has no active global runtime policy for ${definition.fromStatus} → ${definition.toStatus}; authorization metadata cannot be inferred`,
        });
      }
    }
    edges.push(edge);
    existingPairs.add(transitionKey);
    addedEdges.push({ fromStatus: definition.fromStatus, toStatus: definition.toStatus, source });
  }

  const addedNodeStatuses = nodes
    .filter((node) => !currentByStatus.has(node.statusCode as string))
    .map((node) => node.statusCode as string);

  for (const status of occupiedStatuses) {
    const node = nodeByStatus.get(status);
    if (node && !node.isFinal && !edges.some((edge) => edge.fromNodeId === node.id)) {
      issues.push({
        code: 'OCCUPIED_STATUS_NO_EXIT',
        severity: 'BLOCKING',
        status,
        message: `${workflowCode} has live requests in ${status}, but the candidate graph has no outgoing edge`,
      });
    }
  }

  return { graph: { nodes, edges }, addedNodeStatuses, addedEdges, issues };
}
