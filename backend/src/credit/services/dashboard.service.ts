import prisma from '../../utils/prisma';
import { ApplicationState, CommitteeMeetingStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineStateCount {
  state: string;
  count: number;
  avgDaysInState: number;
}

export interface PipelineDashboardResult {
  states: PipelineStateCount[];
  totalApplications: number;
  slaBreachCount: number;
}

export interface ApprovalInboxItem {
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  productType: string;
  requestedAmount: number;
  currency: string;
  currentState: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  submittedAt: string | null;
  daysWaiting: number;
}

export interface ApprovalInboxResult {
  high: ApprovalInboxItem[];
  medium: ApprovalInboxItem[];
  low: ApprovalInboxItem[];
  totalPending: number;
}

export interface ExposureByBorrower {
  borrowerProfileId: string;
  borrowerName: string;
  industry: string | null;
  totalExposure: number;
  rating: string | null;
}

export interface SectorBreakdown {
  sector: string;
  totalExposure: number;
  count: number;
}

export interface RatingDistribution {
  rating: string;
  count: number;
  totalExposure: number;
}

export interface ExposureDashboardResult {
  topBorrowers: ExposureByBorrower[];
  sectorBreakdown: SectorBreakdown[];
  ratingDistribution: RatingDistribution[];
  totalPortfolio: number;
}

export interface CommitteeCalendarItem {
  meetingId: string;
  title: string;
  scheduledAt: string;
  location: string | null;
  status: string;
  meetingType: string;
  agendaCount: number;
}

export interface CommitteeCalendarResult {
  meetings: CommitteeCalendarItem[];
  totalUpcoming: number;
}

// ---------------------------------------------------------------------------
// SLA thresholds per state (business days) — kept simple for Sprint 5
// ---------------------------------------------------------------------------

const SLA_DAYS_BY_STATE: Record<string, number> = {
  DRAFT: 999,
  SUBMITTED: 2,
  KYC_REVIEW: 3,
  KYC_APPROVED: 1,
  KYC_REJECTED: 999,
  UNDERWRITING: 5,
  CREDIT_ASSESSMENT: 5,
  COMMITTEE_REVIEW: 3,
  APPROVED: 2,
  REJECTED: 999,
  OFFER: 3,
  ACCEPTED: 2,
  DISBURSED: 999,
  ACTIVE: 999,
  CLOSED: 999,
  WITHDRAWN: 999,
};

// States that require approval action
const APPROVAL_PENDING_STATES: ApplicationState[] = [
  'UNDERWRITING' as ApplicationState,
  'CREDIT_ASSESSMENT' as ApplicationState,
  'COMMITTEE_REVIEW' as ApplicationState,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

function classifyUrgency(daysWaiting: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (daysWaiting >= 5) return 'HIGH';
  if (daysWaiting >= 3) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class DashboardService {
  /**
   * Get pipeline dashboard — application counts by state, avg days in state,
   * SLA breach count.
   */
  async getPipelineDashboard(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<PipelineDashboardResult> {
    const where: any = { deletedAt: null };
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    // Fetch all non-deleted applications
    const applications = await prisma.creditApplication.findMany({
      where,
      select: {
        state: true,
        createdAt: true,
        submittedAt: true,
        updatedAt: true,
      },
    });

    // Group by state
    const stateMap = new Map<string, { count: number; totalDays: number; breached: number }>();

    for (const app of applications) {
      const st = app.state as string;
      const entry = stateMap.get(st) ?? { count: 0, totalDays: 0, breached: 0 };
      entry.count++;

      // Calculate days in current state: time since last state change approximated by updatedAt
      const refDate = app.submittedAt ?? app.createdAt;
      const daysInState = daysBetween(refDate, new Date());
      entry.totalDays += Math.max(0, daysInState);

      // Check SLA breach
      const slaLimit = SLA_DAYS_BY_STATE[st] ?? 999;
      if (daysInState > slaLimit) {
        entry.breached++;
      }

      stateMap.set(st, entry);
    }

    const states: PipelineStateCount[] = Array.from(stateMap.entries()).map(([state, data]) => ({
      state,
      count: data.count,
      avgDaysInState: data.count > 0 ? Math.round((data.totalDays / data.count) * 10) / 10 : 0,
    }));

    const slaBreachCount = Array.from(stateMap.values()).reduce((sum, d) => sum + d.breached, 0);

    return {
      states,
      totalApplications: applications.length,
      slaBreachCount,
    };
  }

  /**
   * Get approval inbox for a specific user — pending approvals grouped by urgency.
   *
   * Queries CreditApplication where:
   *  - state is in an approval-pending state
   *  - user is assigned as RM or analyst, OR user hasn't yet submitted a decision
   */
  async getApprovalInbox(userId: string, _filters?: {
    urgency?: 'HIGH' | 'MEDIUM' | 'LOW';
    page?: number;
    limit?: number;
  }): Promise<ApprovalInboxResult> {
    // Find applications in approval-pending states where this user is involved
    const applications = await prisma.creditApplication.findMany({
      where: {
        state: { in: APPROVAL_PENDING_STATES },
        deletedAt: null,
        OR: [
          { assignedRmId: userId },
          { assignedAnalystId: userId },
        ],
      },
      include: {
        borrowerProfile: {
          select: {
            id: true,
            creditRiskRating: true,
            account: { select: { name: true, industry: true } },
            contact: { select: { firstName: true, lastName: true } },
          },
        },
        decisions: {
          where: { decisionById: userId },
          select: { id: true },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Also find applications in approval-pending states where the user has NOT yet decided
    // (i.e., they are eligible approvers but haven't acted)
    const appsWithoutDecision = await prisma.creditApplication.findMany({
      where: {
        state: { in: APPROVAL_PENDING_STATES },
        deletedAt: null,
        // Exclude applications where user is the RM (SOD violation) — they're above
        assignedRmId: { not: userId },
        NOT: {
          decisions: {
            some: { decisionById: userId },
          },
        },
      },
      include: {
        borrowerProfile: {
          select: {
            id: true,
            creditRiskRating: true,
            account: { select: { name: true, industry: true } },
            contact: { select: { firstName: true, lastName: true } },
          },
        },
        decisions: { select: { id: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Merge and deduplicate
    const seenIds = new Set<string>();
    const allItems: ApprovalInboxItem[] = [];

    for (const app of [...applications, ...appsWithoutDecision]) {
      if (seenIds.has(app.id)) continue;
      seenIds.add(app.id);

      // Skip if user already submitted a decision (from first query)
      const alreadyDecided = app.decisions.length > 0;
      if (alreadyDecided) continue;

      const borrowerName =
        app.borrowerProfile?.account?.name ??
        (app.borrowerProfile?.contact
          ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}`
          : 'Unknown');

      const submittedAt = app.submittedAt;
      const daysWaiting = submittedAt
        ? daysBetween(new Date(submittedAt), new Date())
        : daysBetween(new Date(app.createdAt), new Date());

      const urgency = classifyUrgency(daysWaiting);

      allItems.push({
        applicationId: app.id,
        applicationNo: (app as any).applicationNo ?? '',
        borrowerName,
        productType: (app as any).productType ?? '',
        requestedAmount: Number((app as any).requestedAmount ?? 0),
        currency: (app as any).currency ?? 'MYR',
        currentState: app.state as string,
        urgency,
        submittedAt: submittedAt?.toISOString() ?? null,
        daysWaiting,
      });
    }

    // Group by urgency
    const high = allItems.filter(i => i.urgency === 'HIGH');
    const medium = allItems.filter(i => i.urgency === 'MEDIUM');
    const low = allItems.filter(i => i.urgency === 'LOW');

    return {
      high,
      medium,
      low,
      totalPending: allItems.length,
    };
  }

  /**
   * Get exposure dashboard — top borrowers by exposure, sector breakdown,
   * rating distribution.
   */
  async getExposureDashboard(filters?: {
    topN?: number;
  }): Promise<ExposureDashboardResult> {
    const topN = filters?.topN ?? 10;

    // Get borrower profiles with their active (non-deleted) applications and facilities
    const borrowers = await prisma.borrowerProfile.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      include: {
        account: { select: { name: true, industry: true } },
        contact: { select: { firstName: true, lastName: true } },
        applications: {
          where: {
            deletedAt: null,
            state: {
              in: [
                'APPROVED' as ApplicationState,
                'OFFER' as ApplicationState,
                'ACCEPTED' as ApplicationState,
                'DISBURSED' as ApplicationState,
                'ACTIVE' as ApplicationState,
              ],
            },
          },
          include: {
            facilities: true,
            scoreRuns: {
              orderBy: { runAt: 'desc' },
              take: 1,
              select: { riskRating: true },
            },
          },
        },
      },
    });

    // Aggregate exposure per borrower
    const borrowerExposures: ExposureByBorrower[] = borrowers.map(bp => {
      const borrowerName =
        bp.account?.name ??
        (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : 'Unknown');
      const industry = bp.account?.industry ?? null;
      const rating = bp.creditRiskRating ?? (bp.applications[0]?.scoreRuns[0]?.riskRating as string | null) ?? null;

      let totalExposure = 0;
      for (const app of bp.applications) {
        for (const fac of app.facilities) {
          totalExposure += Number(fac.approvedAmount ?? fac.amount);
        }
      }

      return {
        borrowerProfileId: bp.id,
        borrowerName,
        industry,
        totalExposure,
        rating,
      };
    });

    // Sort and take top N
    const topBorrowers = borrowerExposures
      .filter(b => b.totalExposure > 0)
      .sort((a, b) => b.totalExposure - a.totalExposure)
      .slice(0, topN);

    // Sector breakdown
    const sectorMap = new Map<string, { totalExposure: number; count: number }>();
    for (const b of borrowerExposures) {
      if (b.totalExposure === 0) continue;
      const sector = b.industry ?? 'Unknown';
      const entry = sectorMap.get(sector) ?? { totalExposure: 0, count: 0 };
      entry.totalExposure += b.totalExposure;
      entry.count++;
      sectorMap.set(sector, entry);
    }

    const sectorBreakdown: SectorBreakdown[] = Array.from(sectorMap.entries())
      .map(([sector, data]) => ({ sector, ...data }))
      .sort((a, b) => b.totalExposure - a.totalExposure);

    // Rating distribution
    const ratingMap = new Map<string, { count: number; totalExposure: number }>();
    for (const b of borrowerExposures) {
      if (b.totalExposure === 0) continue;
      const rating = b.rating ?? 'NR';
      const entry = ratingMap.get(rating) ?? { count: 0, totalExposure: 0 };
      entry.count++;
      entry.totalExposure += b.totalExposure;
      ratingMap.set(rating, entry);
    }

    const ratingDistribution: RatingDistribution[] = Array.from(ratingMap.entries())
      .map(([rating, data]) => ({ rating, ...data }))
      .sort((a, b) => a.rating.localeCompare(b.rating));

    const totalPortfolio = borrowerExposures.reduce((sum, b) => sum + b.totalExposure, 0);

    return {
      topBorrowers,
      sectorBreakdown,
      ratingDistribution,
      totalPortfolio,
    };
  }

  /**
   * Get committee calendar — upcoming committee meetings with agenda counts.
   */
  async getCommitteeCalendar(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<CommitteeCalendarResult> {
    const limit = filters?.limit ?? 10;
    const dateFrom = filters?.dateFrom ?? new Date();
    const dateTo = filters?.dateTo ?? new Date(Date.now() + 30 * 86400000); // 30 days default

    const meetings = await prisma.committeeMeeting.findMany({
      where: {
        scheduledAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: {
          in: [CommitteeMeetingStatus.SCHEDULED, CommitteeMeetingStatus.IN_PROGRESS],
        },
      },
      include: {
        _count: {
          select: { agendaItems: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });

    const items: CommitteeCalendarItem[] = meetings.map(m => ({
      meetingId: m.id,
      title: m.title,
      scheduledAt: m.scheduledAt.toISOString(),
      location: m.location,
      status: m.status,
      meetingType: m.meetingType,
      agendaCount: m._count.agendaItems,
    }));

    return {
      meetings: items,
      totalUpcoming: items.length,
    };
  }
}

export const dashboardService = new DashboardService();