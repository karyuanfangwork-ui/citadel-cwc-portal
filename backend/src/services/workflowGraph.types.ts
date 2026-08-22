/**
 * Shared shapes for the workflow authoring graph. Deliberately decoupled from
 * Prisma row types so the validator and compiler stay pure and testable
 * without a database.
 */

export interface GraphNode {
  id: string;
  type: 'STATUS';
  statusCode: string | null;
  /** Preserved WorkflowStep label; falls back to statusCode for legacy rows. */
  label?: string | null;
  /** Preserved WorkflowStep order; compiler assigns graph order when absent. */
  displayOrder?: number | null;
  positionX: number | null;
  positionY: number | null;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
  icon: string;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transitionLabel: string | null;
  requiresComment: boolean;
  autoAssignRole: string | null;
  autoAssignUserId: string | null;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type FindingCode =
  | 'MISSING_INITIAL'
  | 'MULTIPLE_INITIAL'
  | 'MISSING_FINAL'
  | 'UNREACHABLE'
  | 'NO_PATH_TO_FINAL'
  | 'FINAL_HAS_OUTGOING'
  | 'ORPHAN_NODE'
  | 'DANGLING_EDGE'
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_STATUS_CODE'
  | 'INVALID_STATUS_NODE'
  | 'DUPLICATE_EDGE'
  | 'STATUS_IN_USE_REMOVED'
  | 'OCCUPIED_STATUS_NO_EXIT'
  | 'OPEN_EDGE'
  | 'UNPLACED_STATUS'
  | 'REJECT_WITHOUT_COMMENT'
  | 'REMAP_TARGET_MISSING'
  | 'REMAP_TARGET_NO_EXIT'
  | 'REMAP_SELF'
  | 'REMAP_VOLUME_EXCEEDED'
  | 'REMAP_SOURCE_NOT_REMOVED'
  | 'REMAP_SOURCE_NOT_OCCUPIED'
  | 'STATUS_DEFINITION_NOT_FOUND'
  | 'STATUS_DEFINITION_INACTIVE'
  | 'STATUS_DEFINITION_CATEGORY_MISMATCH'
  | 'STATUS_DEFINITION_LIFECYCLE_CONFLICT'
  | 'UNKNOWN_TRANSITION_LABEL';

export interface Finding {
  code: FindingCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  blocking: Finding[];
  warnings: Finding[];
}

/** One status that the draft removes while live requests still occupy it. */
export interface RemapEntry {
  statusCode: string;
  requestCount: number;
  /** Nearest surviving status reachable from this one in the ACTIVE version, or null. */
  suggestedTarget: string | null;
  /** Human-readable provenance for the suggestion, e.g. "v3 allows A → B". */
  suggestionReason: string;
  /** Every surviving status code in the draft. */
  allowedTargets: string[];
  /** Whether the removed status paused the SLA — drives the UI mismatch warning. */
  sourcePausesSla: boolean;
}

export interface RemapPlan {
  entries: RemapEntry[];
  totalRequests: number;
}