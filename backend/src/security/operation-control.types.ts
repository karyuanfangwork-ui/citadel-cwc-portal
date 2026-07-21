/**
 * Operation Control — typed contract for every API operation.
 *
 * Each record declares the mandatory security metadata that must be present
 * before a route is considered production-ready. The registry is checked by
 * the operation-control coverage test to ensure no operation is left
 * ungoverned.
 *
 * @see docs/esm-production-readiness/remediation-control-register.md
 */

export type RateTier = 'read' | 'write' | 'sensitive' | 'auth';

export interface OperationControl {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** Full API path relative to mount prefix (e.g. "/requests/:id") */
  path: string;

  /** Owning team or individual */
  owner: string;

  /** Minimum authentication level */
  authentication: 'user' | 'platform-admin' | 'system';

  /** Coarse route-level permission (null = authenticated-only) */
  coarsePermission: string | null;

  /** Resource-policy rule name that gates object-level access */
  resourcePolicy: string;

  /** Zod/Joi validation schema name or "none" */
  validation: string;

  /** Response DTO schema name */
  responseSchema: string;

  /** Rate-limit tier */
  rateTier: RateTier;

  /** Audit event type emitted on this operation */
  auditEvent: string;

  /** Audit finding IDs this control remediates */
  auditFindingIds: number[];
}