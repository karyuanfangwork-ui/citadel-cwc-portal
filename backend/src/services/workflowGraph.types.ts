/**
 * Shared shapes for the workflow authoring graph. Deliberately decoupled from
 * Prisma row types so the validator and compiler stay pure and testable
 * without a database.
 */

export interface GraphNode {
  id: string;
  type: 'STATUS';
  statusCode: string | null;
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
  | 'STATUS_IN_USE_REMOVED'
  | 'OCCUPIED_STATUS_NO_EXIT'
  | 'OPEN_EDGE'
  | 'UNPLACED_STATUS'
  | 'REJECT_WITHOUT_COMMENT';

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