import * as crypto from 'crypto';
import prisma from '../../utils/prisma';

// In-memory token store for MVP. In production, use Redis or a DB table.
const exportTokens = new Map<string, {
  userId: string;
  resourceType: string;
  resourceId: string;
  format: string;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
}>();

const TOKEN_EXPIRY_MINUTES = 15;

export class ExportControlService {
  /**
   * Request an export of PII data.
   * Checks credit:export:pii permission (caller must verify before calling).
   * Logs the export request to AuditLog and returns a time-limited token.
   */
  static async requestExport(
    userId: string,
    resourceType: string,
    resourceId: string,
    format: string,
    reason: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    // Log to AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'EXPORT_PII',
        resourceType,
        resourceId,
        newValues: { format, reason },
      },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MINUTES * 60_000);

    exportTokens.set(token, {
      userId,
      resourceType,
      resourceId,
      format,
      reason,
      createdAt: now,
      expiresAt,
    });

    return { token, expiresAt };
  }

  /**
   * Verify an export token is valid and not expired.
   */
  static verifyExportToken(token: string): {
    valid: boolean;
    data?: {
      userId: string;
      resourceType: string;
      resourceId: string;
      format: string;
      reason: string;
      createdAt: Date;
    };
  } {
    const record = exportTokens.get(token);
    if (!record) {
      return { valid: false };
    }
    if (record.expiresAt < new Date()) {
      exportTokens.delete(token);
      return { valid: false };
    }
    return {
      valid: true,
      data: {
        userId: record.userId,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        format: record.format,
        reason: record.reason,
        createdAt: record.createdAt,
      },
    };
  }

  /**
   * Add watermark metadata to export response data.
   * For PDF exports, this would embed a watermark overlay.
   * For data exports (CSV/JSON), this adds watermark metadata to the response.
   */
  static addWatermark(data: any, userId: string, exportToken: string): any {
    const watermark = {
      exportedBy: userId,
      exportToken,
      exportedAt: new Date().toISOString(),
      watermark: 'CONFIDENTIAL — CWC Credit Module Export',
    };

    if (typeof data === 'object' && data !== null) {
      return {
        ...data,
        _watermark: watermark,
      };
    }
    return data;
  }
}