import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { enqueuePdf } from '../../services/pdfJob.service';
import { renderLooHtml, LooTemplateData } from '../templates/loo.html';
import { AuditChainService } from './auditChain.service';

import prisma from '../../utils/prisma';
const LOO_EXPIRY_DAYS = 14;

const LOO_INCLUDE = {
  facilities: true,
  conditions: true,
  decisions: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  borrowerProfile: { select: { id: true, name: true, address: true, registrationNumber: true, industry: true, borrowerType: true, email: true, phone: true } },
} satisfies Prisma.CreditApplicationInclude;

type LooApplicationPayload = Prisma.CreditApplicationGetPayload<{ include: typeof LOO_INCLUDE }>;

export interface LooGenerateResult {
  documentId: string;
  fileName: string;
  version: number;
  generatedAt: Date;
  expiryDate: Date;
  pdfJobId: string;
}

class LooService {
  async generate(applicationId: string, generatedById: string): Promise<LooGenerateResult> {
    const app: LooApplicationPayload | null = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: LOO_INCLUDE,
    });

    if (!app) {
      throw new AppError('Credit application not found', 404);
    }

    if (app.state !== 'APPROVED' && app.state !== 'OFFER') {
      throw new AppError('LOO can only be generated for APPROVED or OFFER state applications', 400);
    }

    // Build template data — §F23: use the application's actual currency
    const appCurrency: string = (app as any).currency ?? 'MYR';
    const facilities = app.facilities.map((f: any) => ({
      facilityType: f.facilityType,
      approvedAmount: f.approvedAmount
        ? `${appCurrency} ${Number(f.approvedAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
        : `${appCurrency} ${Number(f.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`,
      tenor: f.approvedTenor ? `${f.approvedTenor} months` : f.tenorMonths ? `${f.tenorMonths} months` : '—',
      effectiveRate: f.approvedRate
        ? `${Number(f.approvedRate).toFixed(4)}%`
        : f.ratePct
          ? `${Number(f.ratePct).toFixed(4)}%`
          : '—',
      repaymentSchedule: 'As per schedule',
    }));

    const conditionsPrecedent: string[] = app.conditions
      .filter((c: any) => c.conditionType === 'PRECEDENT')
      .map((c: any) => c.description);

    const conditionsSubsequent: string[] = app.conditions
      .filter((c: any) => c.conditionType === 'SUBSEQUENT')
      .map((c: any) => c.description);

    const borrowerProfile: any = app.borrowerProfile;
    const borrowerName: string = borrowerProfile?.name ?? 'Unnamed Borrower';

    const borrowerAddress: string = borrowerProfile?.address ?? 'Address on file';

    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + LOO_EXPIRY_DAYS);

    const newVersion = (app.looVersion ?? 0) + 1;

    const templateData: LooTemplateData = {
      applicationNo: app.applicationNo ?? app.id.slice(0, 8).toUpperCase(),
      date: now.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }),
      lenderName: 'Citadel Bank Berhad',
      lenderAddress: 'Level 20, Menara Citadel, 100 Jalan Sultan Iskandar, 50000 Kuala Lumpur',
      borrowerName,
      borrowerAddress,
      facilities,
      conditionsPrecedent,
      conditionsSubsequent,
      expiryDate: expiryDate.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }),
      expiryDays: LOO_EXPIRY_DAYS,
      version: newVersion,
    };

    // Render HTML and enqueue async PDF generation
    const html = renderLooHtml(templateData);
    const s3Prefix = `uploads/credit/${applicationId}/`;
    const pdfJobId = await enqueuePdf(html, s3Prefix);

    // Save as CreditDocument (fileSize filled by worker after upload)
    const fileName = `LOO-${templateData.applicationNo}-v${newVersion}.pdf`;
    const filePath = `uploads/credit/${applicationId}/${fileName}`;

    const document = await prisma.creditDocument.create({
      data: {
        applicationId,
        borrowerProfileId: app.borrowerProfileId,
        classification: 'LETTER_OF_OFFER',
        fileName,
        filePath,
        fileSize: null, // Filled after worker completes upload
        mimeType: 'application/pdf',
        verificationStatus: 'PENDING',
        uploadedById: generatedById,
        description: `Letter of Offer v${newVersion} generated on ${templateData.date}`,
      },
    });

    // Note: The BullMQ PDF worker uploads the PDF to S3 asynchronously.
    // The client can poll /api/v1/pdf-jobs/:pdfJobId for the presigned download URL.

    // Update application LOO fields
    await prisma.creditApplication.update({
      where: { id: applicationId },
      data: {
        looGeneratedAt: now,
        looExpiryDate: expiryDate,
        looGeneratedById: generatedById,
        looVersion: newVersion,
        state: 'OFFER',
      },
    });

    // Audit log
    await AuditChainService.appendEvent(
      applicationId,
      'LOO_GENERATED',
      generatedById,
      'generate',
      undefined,
      undefined,
      { version: newVersion, documentId: document.id, expiryDate: expiryDate.toISOString() },
    );

    return {
      documentId: document.id,
      fileName,
      version: newVersion,
      generatedAt: now,
      expiryDate,
      pdfJobId,
    };
  }

  async regenerate(applicationId: string, generatedById: string): Promise<LooGenerateResult> {
    return this.generate(applicationId, generatedById);
  }

  async getStatus(applicationId: string) {
    const app = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: {
        looGeneratedAt: true,
        looExpiryDate: true,
        looGeneratedById: true,
        looVersion: true,
        looGeneratedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!app) {
      throw new AppError('Credit application not found', 404);
    }

    // Find the LOO document for download
    const looDoc = await prisma.creditDocument.findFirst({
      where: {
        applicationId,
        classification: 'LETTER_OF_OFFER',
        deletedAt: null,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const expired = app.looExpiryDate ? app.looExpiryDate < now : false;
    const daysRemaining = app.looExpiryDate
      ? Math.max(0, Math.ceil((app.looExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      generatedAt: app.looGeneratedAt,
      expiryDate: app.looExpiryDate,
      generatedBy: app.looGeneratedBy,
      version: app.looVersion ?? 0,
      expired,
      daysRemaining,
      documentId: looDoc?.id ?? null,
    };
  }

  async checkExpiry(applicationId: string): Promise<{ expired: boolean; expiryDate: Date | null }> {
    const app = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { looExpiryDate: true },
    });
    if (!app || !app.looExpiryDate) {
      return { expired: true, expiryDate: null }; // No LOO = can't accept
    }
    return {
      expired: app.looExpiryDate < new Date(),
      expiryDate: app.looExpiryDate,
    };
  }

  async getLooDocument(applicationId: string): Promise<string | null> {
    const doc = await prisma.creditDocument.findFirst({
      where: {
        applicationId,
        classification: 'LETTER_OF_OFFER',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return doc?.id ?? null;
  }

  /**
   * §6.3 — Check all active LOOs for expiry and send notifications.
   * Called by scheduler (daily). Sends warning at 7, 3, 1 days before expiry.
   * Marks expired LOOs so the application state can be handled.
   */
  async checkAndNotifyExpiring(): Promise<{ notified: number; expired: number }> {
    const now = new Date();
    const WARNING_DAYS = [7, 3, 1];

    // Find all applications with active (non-expired) LOOs in OFFER/ACCEPTED state
    const appsWithLoo = await prisma.creditApplication.findMany({
      where: {
        state: { in: ['OFFER', 'ACCEPTED'] },
        looExpiryDate: { not: null, gt: now },
        deletedAt: null,
      },
      select: {
        id: true,
        applicationNo: true,
        looExpiryDate: true,
        assignedRmId: true,
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        borrowerProfile: { select: { id: true, name: true } },
      },
    });

    let notified = 0;

    for (const app of appsWithLoo) {
      if (!app.looExpiryDate) continue;

      const daysRemaining = Math.ceil((app.looExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if we should notify for this number of remaining days
      if (!WARNING_DAYS.includes(daysRemaining)) continue;

      const borrowerName = (app.borrowerProfile as any)?.name ?? 'Unnamed Borrower';

      // Notify assigned RM
      if (app.assignedRmId && app.assignedRm) {
        await prisma.notification.create({
          data: {
            userId: app.assignedRmId,
            channel: 'IN_APP',
            subject: `LOO Expiring in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`,
            body: `Letter of Offer for ${borrowerName} (App: ${app.applicationNo ?? app.id.slice(0, 8)}) expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} on ${app.looExpiryDate.toLocaleDateString('en-MY')}. Follow up with the borrower for acceptance.`,
            relatedRequestId: app.id,
          },
        });
        notified++;
      }

      // Audit event
      await AuditChainService.appendEvent(
        app.id,
        'LOO_EXPIRY_WARNING',
        app.assignedRmId ?? 'system',
        'loo_expiry_check',
        undefined,
        undefined,
        { daysRemaining, expiryDate: app.looExpiryDate.toISOString() },
      );
    }

    // Mark expired LOOs — transition apps past their expiry date
    const justExpired = await prisma.creditApplication.findMany({
      where: {
        state: { in: ['OFFER', 'ACCEPTED'] },
        looExpiryDate: { not: null, lte: now },
        deletedAt: null,
      },
      select: { id: true, applicationNo: true, assignedRmId: true },
    });

    let expired = 0;
    for (const app of justExpired) {
      // Notify RM about expired LOO
      if (app.assignedRmId) {
        await prisma.notification.create({
          data: {
            userId: app.assignedRmId,
            channel: 'IN_APP',
            subject: 'LOO Has Expired',
            body: `Letter of Offer for application ${app.applicationNo ?? app.id.slice(0, 8)} has expired. The borrower must request a new LOO to proceed.`,
            relatedRequestId: app.id,
          },
        });
      }

      await AuditChainService.appendEvent(
        app.id,
        'LOO_EXPIRED',
        app.assignedRmId ?? 'system',
        'loo_expiry_auto',
        undefined,
        undefined,
        { expiredAt: now.toISOString() },
      );
      expired++;
    }

    return { notified, expired };
  }
}

export const looService = new LooService();