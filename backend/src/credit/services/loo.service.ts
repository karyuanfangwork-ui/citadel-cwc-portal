import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { htmlToPdf } from './htmlToPdf.service';
import { renderLooHtml, LooTemplateData } from '../templates/loo.html';
import { AuditChainService } from './auditChain.service';
import { s3Service } from '../../services/s3.service';

const prisma = new PrismaClient();
const LOO_EXPIRY_DAYS = 14;

const LOO_INCLUDE = {
  facilities: true,
  conditions: true,
  decisions: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  borrowerProfile: { include: { account: true, contact: true } },
} satisfies Prisma.CreditApplicationInclude;

type LooApplicationPayload = Prisma.CreditApplicationGetPayload<{ include: typeof LOO_INCLUDE }>;

export interface LooGenerateResult {
  documentId: string;
  fileName: string;
  version: number;
  generatedAt: Date;
  expiryDate: Date;
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

    // Build template data
    const facilities = app.facilities.map((f: any) => ({
      facilityType: f.facilityType,
      approvedAmount: f.approvedAmount
        ? `MYR ${Number(f.approvedAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
        : `MYR ${Number(f.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`,
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
    const borrowerName: string =
      borrowerProfile?.account?.name ??
      (borrowerProfile?.contact
        ? `${borrowerProfile.contact.firstName ?? ''} ${borrowerProfile.contact.lastName ?? ''}`.trim()
        : null) ??
      borrowerProfile?.name ??
      'Unnamed Borrower';

    const borrowerAddress: string = borrowerProfile?.contact?.address ?? 'Address on file';

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

    // Render HTML and convert to PDF
    const html = renderLooHtml(templateData);
    const pdfBuffer = await htmlToPdf(html);

    // Save as CreditDocument
    const fileName = `LOO-${templateData.applicationNo}-v${newVersion}.pdf`;
    const filePath = `uploads/credit/${applicationId}/${fileName}`;

    const document = await prisma.creditDocument.create({
      data: {
        applicationId,
        borrowerProfileId: app.borrowerProfileId,
        classification: 'LETTER_OF_OFFER',
        fileName,
        filePath,
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        verificationStatus: 'PENDING',
        uploadedById: generatedById,
        description: `Letter of Offer v${newVersion} generated on ${templateData.date}`,
      },
    });

    // §2.3 — Upload PDF to S3 so the download endpoint can serve it
    await s3Service.uploadBuffer(filePath, pdfBuffer, 'application/pdf');

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
}

export const looService = new LooService();