import { PlatformAuditChainService } from './platformAuditChain.service';

export type RetentionAction = 'RETAIN' | 'ARCHIVE_ELIGIBLE' | 'BLOCKED_LEGAL_HOLD';

export interface RetentionEvaluationInput {
  resourceType: string;
  retentionUntil?: Date | null;
  legalHoldAt?: Date | null;
  now?: Date;
}

export interface RetentionEvaluationResult {
  allowed: boolean;
  action: RetentionAction;
  reason: string;
}

export interface DlpExportAuditInput {
  tenantId: string;
  departmentId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  resourceType: string;
  resourceId?: string | null;
  reportType: string;
  format: string;
  rowCount: number;
  filters?: Record<string, unknown> | null;
  correlationId?: string | null;
}

export class RetentionPolicyService {
  static evaluateRetentionAction(input: RetentionEvaluationInput): RetentionEvaluationResult {
    if (input.legalHoldAt) {
      return {
        allowed: false,
        action: 'BLOCKED_LEGAL_HOLD',
        reason: `${input.resourceType} is under legal hold and cannot be archived or purged`,
      };
    }

    const now = input.now ?? new Date();
    if (input.retentionUntil && input.retentionUntil.getTime() <= now.getTime()) {
      return {
        allowed: true,
        action: 'ARCHIVE_ELIGIBLE',
        reason: `${input.resourceType} retention period has elapsed and is eligible for reviewed archival`,
      };
    }

    return {
      allowed: false,
      action: 'RETAIN',
      reason: `${input.resourceType} is still within retention period`,
    };
  }

  static async recordDlpExportAudit(input: DlpExportAuditInput): Promise<string> {
    return PlatformAuditChainService.appendEvent({
      tenantId: input.tenantId,
      departmentId: input.departmentId ?? null,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: 'DLP_EXPORT',
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      correlationId: input.correlationId ?? null,
      oldValues: null,
      newValues: {
        reportType: input.reportType,
        format: input.format,
        rowCount: input.rowCount,
        filters: input.filters ?? null,
      },
      metadata: {
        dataClass: 'EXPORT_EVIDENCE',
        reportType: input.reportType,
        format: input.format,
        rowCount: input.rowCount,
      },
    });
  }
}
