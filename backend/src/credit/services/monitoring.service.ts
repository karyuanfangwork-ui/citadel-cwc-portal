import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import {
  HealthStatus,
  CovenantType,
  CovenantFrequency,
  PaymentStatus,
  SignalType,
  EarlyWarningSeverity,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateFacilityHealthData {
  applicationId: string;
  healthStatus?: HealthStatus;
  lastReviewDate?: Date | string | null;
  nextReviewDate?: Date | string | null;
  reviewFrequency?: CovenantFrequency;
  notes?: string | null;
  updatedById?: string | null;
}

export interface UpdateFacilityHealthData {
  healthStatus?: HealthStatus;
  lastReviewDate?: Date | string | null;
  nextReviewDate?: Date | string | null;
  reviewFrequency?: CovenantFrequency;
  notes?: string | null;
  updatedById?: string | null;
}

export interface CreateCovenantData {
  applicationId: string;
  description: string;
  covenantType: CovenantType;
  metricKey?: string | null;
  threshold?: string | number | null;
  frequency?: CovenantFrequency;
  isActive?: boolean;
}

export interface CreateCovenantTestData {
  covenantId: string;
  testDate: Date | string;
  reportedValue?: string | number | null;
  isCompliant: boolean;
  testedById?: string | null;
  notes?: string | null;
}

export interface CreatePaymentEventData {
  applicationId: string;
  dueDate: Date | string;
  paidDate?: Date | string | null;
  amount: string | number;
  status?: PaymentStatus;
}

export interface UpdatePaymentEventData {
  paidDate?: Date | string | null;
  status?: PaymentStatus;
}

export interface CreateEarlyWarningSignalData {
  applicationId: string;
  signalType: SignalType;
  severity?: EarlyWarningSeverity;
  description: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class MonitoringService {
  // FacilityHealth
  async getFacilityHealth(applicationId: string) {
    return prisma.facilityHealth.findUnique({
      where: { applicationId },
      include: { updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async createFacilityHealth(data: CreateFacilityHealthData) {
    return prisma.facilityHealth.upsert({
      where: { applicationId: data.applicationId },
      update: {
        ...(data.healthStatus ? { healthStatus: data.healthStatus } : {}),
        ...(data.lastReviewDate !== undefined ? { lastReviewDate: data.lastReviewDate ? new Date(data.lastReviewDate) : null } : {}),
        ...(data.nextReviewDate !== undefined ? { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null } : {}),
        ...(data.reviewFrequency ? { reviewFrequency: data.reviewFrequency } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.updatedById ? { updatedById: data.updatedById } : {}),
      },
      create: {
        applicationId: data.applicationId,
        ...(data.healthStatus ? { healthStatus: data.healthStatus } : {}),
        ...(data.lastReviewDate !== undefined ? { lastReviewDate: data.lastReviewDate ? new Date(data.lastReviewDate) : null } : {}),
        ...(data.nextReviewDate !== undefined ? { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null } : {}),
        ...(data.reviewFrequency ? { reviewFrequency: data.reviewFrequency } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.updatedById ? { updatedById: data.updatedById } : {}),
      },
      include: { updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async updateFacilityHealth(applicationId: string, data: UpdateFacilityHealthData) {
    return prisma.facilityHealth.update({
      where: { applicationId },
      data: {
        ...(data.healthStatus ? { healthStatus: data.healthStatus } : {}),
        ...(data.lastReviewDate !== undefined ? { lastReviewDate: data.lastReviewDate ? new Date(data.lastReviewDate) : null } : {}),
        ...(data.nextReviewDate !== undefined ? { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null } : {}),
        ...(data.reviewFrequency ? { reviewFrequency: data.reviewFrequency } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.updatedById ? { updatedById: data.updatedById } : {}),
      },
      include: { updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  // CovenantDefinition
  async listCovenants(applicationId: string) {
    return prisma.covenantDefinition.findMany({
      where: { applicationId },
      include: { tests: { orderBy: { testDate: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCovenant(data: CreateCovenantData) {
    return prisma.covenantDefinition.create({
      data: {
        applicationId: data.applicationId,
        description: data.description,
        covenantType: data.covenantType,
        ...(data.metricKey !== undefined ? { metricKey: data.metricKey } : {}),
        ...(data.threshold !== undefined && data.threshold !== null
          ? { threshold: new Prisma.Decimal(String(data.threshold)) }
          : {}),
        ...(data.frequency ? { frequency: data.frequency } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  // CovenantTest
  async listTests(covenantId: string) {
    return prisma.covenantTest.findMany({
      where: { covenantId },
      include: { testedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { testDate: 'desc' },
    });
  }

  async createTest(data: CreateCovenantTestData) {
    const test = await prisma.covenantTest.create({
      data: {
        covenantId: data.covenantId,
        testDate: new Date(data.testDate),
        ...(data.reportedValue !== undefined && data.reportedValue !== null
          ? { reportedValue: new Prisma.Decimal(String(data.reportedValue)) }
          : {}),
        isCompliant: data.isCompliant,
        ...(data.testedById ? { testedById: data.testedById } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: { testedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await this.checkCovenantBreach(data.covenantId);
    return test;
  }

  // PaymentEvent
  async listPayments(applicationId: string) {
    return prisma.paymentEvent.findMany({
      where: { applicationId },
      orderBy: { dueDate: 'desc' },
    });
  }

  async createPayment(data: CreatePaymentEventData) {
    return prisma.paymentEvent.create({
      data: {
        applicationId: data.applicationId,
        dueDate: new Date(data.dueDate),
        ...(data.paidDate !== undefined ? { paidDate: data.paidDate ? new Date(data.paidDate) : null } : {}),
        amount: new Prisma.Decimal(String(data.amount)),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async updatePaymentStatus(paymentId: string, data: UpdatePaymentEventData) {
    const payment = await prisma.paymentEvent.update({
      where: { id: paymentId },
      data: {
        ...(data.paidDate !== undefined ? { paidDate: data.paidDate ? new Date(data.paidDate) : null } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });

    await this.checkPaymentOverdue(payment.applicationId);
    return payment;
  }

  // EarlyWarningSignal
  async listSignals(applicationId: string) {
    return prisma.earlyWarningSignal.findMany({
      where: { applicationId },
      include: { resolvedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { openedAt: 'desc' },
    });
  }

  async listActiveSignals() {
    return prisma.earlyWarningSignal.findMany({
      where: { closedAt: null },
      include: {
        application: { select: { id: true, applicationNo: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async createSignal(data: CreateEarlyWarningSignalData) {
    return prisma.earlyWarningSignal.create({
      data: {
        applicationId: data.applicationId,
        signalType: data.signalType,
        ...(data.severity ? { severity: data.severity } : {}),
        description: data.description,
      },
    });
  }

  async resolveSignal(signalId: string, resolvedById: string) {
    return prisma.earlyWarningSignal.update({
      where: { id: signalId },
      data: { closedAt: new Date(), resolvedById },
      include: { resolvedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  // Business Logic: Covenant Breach Detection
  async checkCovenantBreach(covenantId: string) {
    const latestTest = await prisma.covenantTest.findFirst({
      where: { covenantId },
      orderBy: { testDate: 'desc' },
      include: { covenant: true },
    });

    if (!latestTest || !latestTest.covenant) return null;

    if (!latestTest.isCompliant) {
      let severity: EarlyWarningSeverity = 'MEDIUM' as EarlyWarningSeverity;
      const covenantType = latestTest.covenant.covenantType;
      if (['DEBT_SERVICE_COVERAGE', 'LOAN_TO_VALUE'].includes(covenantType)) {
        severity = 'HIGH' as EarlyWarningSeverity;
      } else if (covenantType === 'FINANCIAL_RATIO') {
        severity = 'CRITICAL' as EarlyWarningSeverity;
      }

      const existing = await prisma.earlyWarningSignal.findFirst({
        where: {
          applicationId: latestTest.covenant.applicationId,
          signalType: 'COVENANT_BREACH' as SignalType,
          closedAt: null,
          description: { contains: covenantId },
        },
      });

      if (!existing) {
        return prisma.earlyWarningSignal.create({
          data: {
            applicationId: latestTest.covenant.applicationId,
            signalType: 'COVENANT_BREACH' as SignalType,
            severity,
            description: `Covenant breach detected: ${latestTest.covenant.description} (ID: ${covenantId}). Latest test on ${latestTest.testDate.toISOString().slice(0, 10)} was non-compliant.`,
          },
        });
      }
    }

    return null;
  }

  // Business Logic: Payment Overdue Detection
  async checkPaymentOverdue(applicationId: string) {
    const overduePayments = await prisma.paymentEvent.findMany({
      where: { applicationId, status: { in: ['LATE_90' as PaymentStatus, 'MISSED' as PaymentStatus] } },
    });

    if (overduePayments.length === 0) return null;

    const existing = await prisma.earlyWarningSignal.findFirst({
      where: { applicationId, signalType: 'PAYMENT_OVERDUE' as SignalType, closedAt: null },
    });

    if (!existing) {
      return prisma.earlyWarningSignal.create({
        data: {
          applicationId,
          signalType: 'PAYMENT_OVERDUE' as SignalType,
          severity: 'HIGH' as EarlyWarningSeverity,
          description: `${overduePayments.length} payment(s) are 90+ days overdue or missed for application ${applicationId}.`,
        },
      });
    }

    return null;
  }

  // Business Logic: Review Due Check
  async checkReviewDue() {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return prisma.facilityHealth.findMany({
      where: {
        nextReviewDate: { lte: sevenDaysFromNow },
        healthStatus: { not: 'DEFAULT' as HealthStatus },
      },
      include: {
        application: { select: { id: true, applicationNo: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { nextReviewDate: 'asc' },
    });
  }
}

export const monitoringService = new MonitoringService();