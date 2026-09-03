/**
 * Canonical, read-only definition for Finance Purchase Requisition.
 *
 * This file is deliberately pure: it contains no Prisma import and no write
 * path. The graph is derived from the runtime Finance controller/transition
 * evidence, not from the incomplete v7/v8 authoring graphs.
 */
import { createHash } from 'crypto';
import { GraphEdge, GraphNode, WorkflowGraph } from '../services/workflowGraph.types';

export interface CanonicalGraph extends WorkflowGraph {
  workflowCode: 'FINANCE';
  requestTypeCode: 'PURCHASE_REQUISITION';
  approvalOrder: ['CEO', 'CFO', 'GROUP_DCEO'];
}

export interface GraphComparison {
  versionId: string;
  version: number;
  status: string;
  addedStatuses: string[];
  missingStatuses: string[];
  addedEdges: string[];
  missingEdges: string[];
  changedEdges: string[];
  duplicateOutgoingLabels: Array<{ fromStatus: string; label: string; edgeCount: number }>;
}

export interface GraphFingerprint {
  hash: string;
  nodeCount: number;
  edgeCount: number;
  statuses: string[];
  edges: string[];
}

const STATUS = {
  pendingAck: 'FINANCE_PENDING_ACK',
  acknowledged: 'FINANCE_ACKNOWLEDGED',
  pendingCeo: 'PENDING_CEO_APPROVAL_FIN',
  ceoApproved: 'CEO_APPROVED_FIN',
  ceoRejected: 'CEO_REJECTED_FIN',
  pendingCfo: 'PENDING_CFO_APPROVAL_FIN',
  cfoApproved: 'CFO_APPROVED_FIN',
  cfoRejected: 'CFO_REJECTED_FIN',
  pendingDceo: 'PENDING_GROUP_DCEO_APPROVAL',
  dceoApproved: 'GROUP_DCEO_APPROVED',
  dceoRejected: 'GROUP_DCEO_REJECTED',
  paymentProcessing: 'PAYMENT_PROCESSING_FIN',
  paymentAwaitingConfirmation: 'AWAITING_PAYMENT_CONFIRMATION',
  paymentConfirmed: 'PAYMENT_CONFIRMED_FIN',
  closed: 'TICKET_CLOSED_FIN',
  cancelled: 'CANCELLED',
} as const;

interface NodeSpec {
  status: string;
  label: string;
  isInitial?: boolean;
  isFinal?: boolean;
  slaPause?: boolean;
  icon?: string;
}

interface EdgeSpec {
  from: string;
  to: string;
  label: string;
  requiresComment?: boolean;
  allowedExecutiveRoles?: string[];
  allowedRoles?: string[];
}

const nodeSpecs: NodeSpec[] = [
  { status: STATUS.pendingAck, label: 'Finance Pending Acknowledgement', isInitial: true },
  { status: STATUS.acknowledged, label: 'Finance Acknowledged' },
  { status: 'FINANCE_IN_PROGRESS', label: 'Finance In Progress' },
  { status: STATUS.pendingCeo, label: 'Pending CEO Approval (Finance)', slaPause: true },
  { status: STATUS.ceoApproved, label: 'CEO Approved (Finance)' },
  { status: STATUS.ceoRejected, label: 'CEO Rejected (Finance)', isFinal: true },
  { status: STATUS.pendingCfo, label: 'Pending CFO Approval (Finance)', slaPause: true },
  { status: STATUS.cfoApproved, label: 'CFO Approved (Finance)' },
  { status: STATUS.cfoRejected, label: 'CFO Rejected (Finance)' },
  { status: STATUS.pendingDceo, label: 'Pending Group DCEO Approval', slaPause: true },
  { status: STATUS.dceoApproved, label: 'Group DCEO Approved' },
  { status: STATUS.dceoRejected, label: 'Group DCEO Rejected' },
  { status: 'REJECTED', label: 'Rejected', isFinal: true },
  { status: STATUS.paymentProcessing, label: 'Payment Processing' },
  { status: STATUS.paymentAwaitingConfirmation, label: 'Awaiting Payment Confirmation' },
  { status: STATUS.paymentConfirmed, label: 'Payment Confirmed' },
  { status: STATUS.closed, label: 'Closed', isFinal: true },
  // These are confirmed by the Finance controller's cancellation guard.
  { status: STATUS.cancelled, label: 'Cancelled', isFinal: true },
];

const edgeSpecs: EdgeSpec[] = [
  { from: STATUS.pendingAck, to: STATUS.acknowledged, label: 'ACKNOWLEDGE', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.acknowledged, to: STATUS.pendingCeo, label: 'SUBMIT', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.acknowledged, to: 'FINANCE_IN_PROGRESS', label: 'ADVANCE', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: 'FINANCE_IN_PROGRESS', to: STATUS.pendingCeo, label: 'SUBMIT', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: 'FINANCE_IN_PROGRESS', to: STATUS.cancelled, label: 'CANCEL', requiresComment: true, allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.pendingCeo, to: STATUS.pendingCfo, label: 'APPROVE', allowedExecutiveRoles: ['CEO'] },
  { from: STATUS.pendingCeo, to: STATUS.ceoApproved, label: 'ADVANCE', allowedExecutiveRoles: ['CEO'] },
  { from: STATUS.ceoApproved, to: STATUS.pendingCfo, label: 'ADVANCE', allowedExecutiveRoles: ['CEO'] },
  { from: STATUS.pendingCeo, to: STATUS.ceoRejected, label: 'REJECT', requiresComment: true, allowedExecutiveRoles: ['CEO'] },
  { from: STATUS.pendingCfo, to: STATUS.cfoApproved, label: 'APPROVE', allowedExecutiveRoles: ['CFO'] },
  { from: STATUS.pendingCfo, to: STATUS.cfoRejected, label: 'REJECT', requiresComment: true, allowedExecutiveRoles: ['CFO'] },
  { from: STATUS.cfoRejected, to: 'REJECTED', label: 'CLOSE', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.cfoApproved, to: STATUS.pendingDceo, label: 'APPROVE', allowedRoles: ['AGENT', 'ADMIN'], allowedExecutiveRoles: ['CFO'] },
  { from: STATUS.pendingDceo, to: STATUS.dceoApproved, label: 'APPROVE', allowedExecutiveRoles: ['GROUP_DCEO'] },
  { from: STATUS.pendingDceo, to: STATUS.dceoRejected, label: 'REJECT', requiresComment: true, allowedExecutiveRoles: ['GROUP_DCEO'] },
  { from: STATUS.dceoRejected, to: 'REJECTED', label: 'CLOSE', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.dceoApproved, to: STATUS.paymentProcessing, label: 'ADVANCE', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.paymentProcessing, to: STATUS.paymentAwaitingConfirmation, label: 'PAYMENT_COMPLETE', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.paymentAwaitingConfirmation, to: STATUS.paymentConfirmed, label: 'CONFIRM_PAYMENT', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.paymentAwaitingConfirmation, to: STATUS.closed, label: 'CLOSE', allowedRoles: ['AGENT', 'ADMIN'] },
  { from: STATUS.paymentConfirmed, to: STATUS.closed, label: 'CLOSE', allowedRoles: ['AGENT', 'ADMIN'] },
  ...[STATUS.pendingAck, STATUS.acknowledged].map((from) => ({
    from,
    to: STATUS.cancelled,
    label: 'CANCEL',
    requiresComment: true,
    allowedRoles: ['AGENT', 'ADMIN'],
  })),
];

const nodeId = (status: string) => `finance-pr-status-${status}`;
const edgeId = (from: string, to: string) => `finance-pr-edge-${from}-${to}`;

export function buildCanonicalFinancePurchaseRequisitionGraph(): CanonicalGraph {
  const nodes: GraphNode[] = nodeSpecs.map((spec, index) => ({
    id: nodeId(spec.status),
    type: 'STATUS',
    statusCode: spec.status,
    label: spec.label,
    displayOrder: index + 1,
    positionX: null,
    positionY: null,
    isInitial: spec.isInitial ?? false,
    isFinal: spec.isFinal ?? false,
    slaPause: spec.slaPause ?? false,
    icon: spec.isFinal ? 'check_circle' : 'radio_button_checked',
  }));
  const edges: GraphEdge[] = edgeSpecs.map((spec) => ({
    id: edgeId(spec.from, spec.to),
    fromNodeId: nodeId(spec.from),
    toNodeId: nodeId(spec.to),
    transitionLabel: spec.label,
    requiresComment: spec.requiresComment ?? false,
    autoAssignRole: null,
    autoAssignUserId: null,
    allowedRoles: [...(spec.allowedRoles ?? [])].sort(),
    allowedExecutiveRoles: [...(spec.allowedExecutiveRoles ?? [])].sort(),
  }));
  return { workflowCode: 'FINANCE', requestTypeCode: 'PURCHASE_REQUISITION', approvalOrder: ['CEO', 'CFO', 'GROUP_DCEO'], nodes, edges };
}

function canonicalPayload(graph: WorkflowGraph) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node.statusCode]));
  const nodes = graph.nodes.map((node) => ({
    statusCode: node.statusCode,
    label: node.label ?? null,
    displayOrder: node.displayOrder ?? null,
    isInitial: node.isInitial,
    isFinal: node.isFinal,
    slaPause: node.slaPause,
    icon: node.icon,
  })).sort((a, b) => String(a.statusCode).localeCompare(String(b.statusCode)));
  const edges = graph.edges.map((edge) => ({
    fromStatus: byId.get(edge.fromNodeId),
    toStatus: byId.get(edge.toNodeId),
    transitionLabel: edge.transitionLabel,
    requiresComment: edge.requiresComment,
    autoAssignRole: edge.autoAssignRole,
    autoAssignUserId: edge.autoAssignUserId,
    allowedRoles: [...edge.allowedRoles].sort(),
    allowedExecutiveRoles: [...edge.allowedExecutiveRoles].sort(),
  })).sort((a, b) => `${a.fromStatus}->${a.toStatus}:${a.transitionLabel}`.localeCompare(`${b.fromStatus}->${b.toStatus}:${b.transitionLabel}`));
  return { nodes, edges };
}

export function fingerprintGraph(graph: WorkflowGraph): GraphFingerprint {
  const payload = canonicalPayload(graph);
  const statuses = payload.nodes.map((node) => node.statusCode).filter((value): value is string => Boolean(value));
  const edges = payload.edges.map((edge) => `${edge.fromStatus}->${edge.toStatus}:${edge.transitionLabel}`);
  return {
    hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    nodeCount: payload.nodes.length,
    edgeCount: payload.edges.length,
    statuses,
    edges,
  };
}

function graphFromVersion(version: any): WorkflowGraph {
  return {
    nodes: (version.nodes ?? []).map((node: any) => ({ ...node, type: 'STATUS' })),
    edges: (version.edges ?? []).map((edge: any) => ({ ...edge })),
  };
}

export function compareFinanceVersion(version: any, canonical = buildCanonicalFinancePurchaseRequisitionGraph()): GraphComparison {
  const actual = graphFromVersion(version);
  const expected = fingerprintGraph(canonical);
  const actualFingerprint = fingerprintGraph(actual);
  const actualStatuses = new Set(actualFingerprint.statuses);
  const expectedStatuses = new Set(expected.statuses);
  const actualEdges = new Set(actualFingerprint.edges);
  const expectedEdges = new Set(expected.edges);
  const actualByPair = new Map(actualFingerprint.edges.map((value) => [value.split(':')[0], value]));
  const expectedByPair = new Map(expected.edges.map((value) => [value.split(':')[0], value]));
  const duplicateMap = new Map<string, number>();
  for (const edge of actual.edges) {
    const from = actual.nodes.find((node: any) => node.id === edge.fromNodeId)?.statusCode;
    if (from && edge.transitionLabel) duplicateMap.set(`${from}\u0000${edge.transitionLabel}`, (duplicateMap.get(`${from}\u0000${edge.transitionLabel}`) ?? 0) + 1);
  }
  return {
    versionId: version.id,
    version: version.version,
    status: String(version.status),
    addedStatuses: [...expectedStatuses].filter((status) => !actualStatuses.has(status)).sort(),
    missingStatuses: [...actualStatuses].filter((status) => !expectedStatuses.has(status)).sort(),
    addedEdges: [...expectedEdges].filter((edge) => !actualEdges.has(edge)).sort(),
    missingEdges: [...actualEdges].filter((edge) => !expectedEdges.has(edge)).sort(),
    changedEdges: [...expectedByPair.keys()].filter((pair) => actualByPair.has(pair) && actualByPair.get(pair) !== expectedByPair.get(pair)).sort(),
    duplicateOutgoingLabels: [...duplicateMap.entries()].filter(([, count]) => count > 1).map(([value, edgeCount]) => {
      const [fromStatus, label] = value.split('\u0000');
      return { fromStatus, label, edgeCount };
    }).sort((a, b) => `${a.fromStatus}:${a.label}`.localeCompare(`${b.fromStatus}:${b.label}`)),
  };
}

export const FINANCE_RUNTIME_STATUS_EVIDENCE = Object.values(STATUS);
export const FINANCE_CANONICAL_GRAPH = buildCanonicalFinancePurchaseRequisitionGraph();
export const FINANCE_CANONICAL_FINGERPRINT = fingerprintGraph(FINANCE_CANONICAL_GRAPH);
