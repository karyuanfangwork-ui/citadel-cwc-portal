import prisma from '../../utils/prisma';
import { ApplicationState, CommitteeMeetingStatus } from '@prisma/client';
import { formatCurrency } from '../utils/formatCurrency';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineStateCount {
  state: string;
  count: number;
  avgDaysInState: number;
}

export interface SlaBreachItem {
  id: string;
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  currentState: string;
  breachedAt: string;
  daysOverdue: number;
  policyName: string;
}

export interface PipelineDashboardResult {
  states: PipelineStateCount[];
  totalApplications: number;
  slaBreachCount: number;
  slaBreaches: SlaBreachItem[];
}

export interface MyWorkItem {
  id: string;
  applicationNo: string;
  state: string;
  borrowerName: string;
  productType: string;
  updatedAt: string;
}

export interface MyWorkDashboardResult {
  myApprovalCount: number;
  myAssignedCount: number;
  mySlaBreaches: number;
  mySlaBreachItems: SlaBreachItem[];
  recentAssigned: MyWorkItem[];
  recentApprovals: MyWorkItem[];
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
// §5.2 — Approval Turnaround Report types
// ---------------------------------------------------------------------------

export interface TurnaroundAppRow {
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  productType: string;
  rmName: string;
  submittedAt: string;
  firstApprovalAt: string;
  turnaroundDays: number;
}

export interface TurnaroundGroup {
  key: string;
  label: string;
  count: number;
  avgDays: number;
  medianDays: number;
  p90Days: number;
}

export interface TurnaroundResult {
  applications: TurnaroundAppRow[];
  summary: {
    groupBy: string;
    groups: TurnaroundGroup[];
    overall: TurnaroundGroup;
  };
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
   * SLA breach count, and itemized SLA breaches.
   */
  async getPipelineDashboard(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    branchId?: string;
    assignedToMe?: string;
  }): Promise<PipelineDashboardResult> {
    const where: any = { deletedAt: null };
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.assignedToMe) {
      where.OR = [
        { assignedRmId: filters.assignedToMe },
        { assignedAnalystId: filters.assignedToMe },
      ];
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

      // Calculate days in current state using updatedAt for time in current state
      // TODO: Track state-change timestamps via audit events for more accuracy
      const refDate = app.updatedAt ?? app.createdAt;
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

    // Fetch itemized SLA breaches from the CreditSlaBreach table (authoritative source)
    const activeBreaches = await prisma.creditSlaBreach.findMany({
      where: { resolvedAt: null },
      include: {
        application: {
          select: {
            id: true,
            applicationNo: true,
            state: true,
            borrowerProfile: {
              select: {
                id: true,
                name: true,
                account: { select: { name: true } },
                contact: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        policy: { select: { name: true, targetState: true } },
      },
      orderBy: { breachedAt: 'asc' },
      take: 50,
    });

    const slaBreaches: SlaBreachItem[] = activeBreaches.map(b => {
      const bp = b.application.borrowerProfile;
      const borrowerName = bp?.account?.name
        ?? (bp?.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : null)
        ?? bp?.name
        ?? 'Unknown';
      return {
        id: b.id,
        applicationId: b.application.id,
        applicationNo: b.application.applicationNo,
        borrowerName,
        currentState: b.application.state,
        breachedAt: b.breachedAt.toISOString(),
        daysOverdue: Math.floor((Date.now() - b.breachedAt.getTime()) / 86400000),
        policyName: b.policy.name,
      };
    });

    return {
      states,
      totalApplications: applications.length,
      slaBreachCount,
      slaBreaches,
    };
  }

  /**
   * Get My Work dashboard — pending approvals, assigned cases, and SLA breaches
   * for the current user.
   */
  async getMyWorkDashboard(userId: string, branchId?: string): Promise<MyWorkDashboardResult> {
    const branchFilter = branchId ? { branchId } : {};

    // Pending approvals where user is RM/analyst and app is in an approval-pending state
    const myApprovalsWhere = {
      state: { in: APPROVAL_PENDING_STATES },
      deletedAt: null,
      OR: [
        { assignedRmId: userId },
        { assignedAnalystId: userId },
      ],
      ...branchFilter,
    };

    // My assigned cases (RM or analyst) that are not closed/withdrawn
    const myAssignedWhere = {
      deletedAt: null,
      state: { notIn: ['CLOSED', 'WITHDRAWN'] as any[] },
      OR: [
        { assignedRmId: userId },
        { assignedAnalystId: userId },
      ],
      ...branchFilter,
    };

    const selectFields = {
      id: true,
      applicationNo: true,
      state: true,
      productType: true,
      updatedAt: true,
      borrowerProfile: {
        select: {
          id: true,
          name: true,
          account: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      },
    };

    const [myApprovals, myApprovalCount, myAssigned, myAssignedCount] = await Promise.all([
      prisma.creditApplication.findMany({
        where: myApprovalsWhere,
        select: selectFields,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.creditApplication.count({ where: myApprovalsWhere }),
      prisma.creditApplication.findMany({
        where: myAssignedWhere,
        select: selectFields,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.creditApplication.count({ where: myAssignedWhere }),
    ]);

    // My SLA breaches — unresolved breaches on applications where user is RM or analyst
    const myBreaches = await prisma.creditSlaBreach.findMany({
      where: {
        resolvedAt: null,
        application: {
          OR: [
            { assignedRmId: userId },
            { assignedAnalystId: userId },
          ],
        },
      },
      include: {
        application: { select: { id: true, applicationNo: true, state: true, borrowerProfile: { select: { id: true, name: true, account: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } } } },
        policy: { select: { name: true } },
      },
    });

    const toMyWorkItem = (app: any): MyWorkItem => {
      const bp = app.borrowerProfile;
      const borrowerName = bp?.account?.name
        ?? (bp?.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : null)
        ?? bp?.name
        ?? 'Unknown';
      return {
        id: app.id,
        applicationNo: app.applicationNo ?? '',
        state: app.state as string,
        borrowerName,
        productType: app.productType ?? '',
        updatedAt: app.updatedAt.toISOString(),
      };
    };

    const mySlaBreachItems: SlaBreachItem[] = myBreaches.map(b => {
      const bp = (b as any).application?.borrowerProfile;
      const borrowerName = bp?.account?.name
        ?? (bp?.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : null)
        ?? bp?.name
        ?? 'Unknown';
      return {
        id: b.id,
        applicationId: b.application.id,
        applicationNo: b.application.applicationNo,
        borrowerName,
        currentState: b.application.state,
        breachedAt: b.breachedAt.toISOString(),
        daysOverdue: Math.floor((Date.now() - b.breachedAt.getTime()) / 86400000),
        policyName: b.policy.name,
      };
    });

    return {
      myApprovalCount,
      myAssignedCount,
      mySlaBreaches: myBreaches.length,
      mySlaBreachItems,
      recentAssigned: myAssigned.map(toMyWorkItem),
      recentApprovals: myApprovals.map(toMyWorkItem),
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
        requestedAmount: formatCurrency((app as any).requestedAmount) ?? 0,
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
    branchId?: string;
  }): Promise<ExposureDashboardResult> {
    const topN = filters?.topN ?? 10;

    // Get borrower profiles with their active (non-deleted) applications and facilities
    const borrowers = await prisma.borrowerProfile.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(filters?.branchId ? { branchId: filters.branchId } : {}),
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
    // TODO: Replace with DB-level aggregation (Prisma groupBy + _sum) for production scale
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
   * §2.6 — Get exposure summary with approaching/breached limits.
   */
  async getExposureSummary(filters?: { rmId?: string; borrowerGroupId?: string; riskRating?: string }) {
    // Build borrower filter
    const where: any = { isActive: true, deletedAt: null };
    if (filters?.rmId) where.relationshipManagerId = filters.rmId;
    if (filters?.riskRating) where.creditRiskRating = filters.riskRating;

    const borrowers = await prisma.borrowerProfile.findMany({
      where,
      include: {
        account: { select: { name: true, industry: true } },
        contact: { select: { firstName: true, lastName: true } },
        applications: {
          where: {
            deletedAt: null,
            state: { in: ['APPROVED', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE'] as any[] },
          },
          include: { facilities: true },
        },
      },
    });

    let totalPortfolioExposure = 0;
    const approachingLimit: Array<{ borrowerProfileId: string; borrowerName: string; totalExposure: number; exposureLimit: number; utilisationPct: number }> = [];
    const breachedLimit: Array<{ borrowerProfileId: string; borrowerName: string; totalExposure: number; exposureLimit: number; utilisationPct: number }> = [];

    // product type breakdown
    const byProductType: Record<string, number> = {};

    for (const bp of borrowers) {
      const borrowerName = bp.account?.name ?? (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : 'Unknown');
      let totalExposure = 0;
      for (const app of bp.applications) {
        for (const fac of app.facilities) {
          const amt = Number(fac.approvedAmount ?? fac.amount ?? 0);
          totalExposure += amt;
          const productType = fac.facilityType ?? 'OTHER';
          byProductType[productType] = (byProductType[productType] ?? 0) + amt;
        }
      }
      totalPortfolioExposure += totalExposure;

      const exposureLimit = Number(bp.exposureLimit ?? 0);
      if (exposureLimit > 0) {
        const utilisationPct = (totalExposure / exposureLimit) * 100;
        const entry = { borrowerProfileId: bp.id, borrowerName, totalExposure, exposureLimit, utilisationPct: Math.round(utilisationPct * 10) / 10 };
        if (utilisationPct > 100) {
          breachedLimit.push(entry);
        } else if (utilisationPct >= 90) {
          approachingLimit.push(entry);
        }
      }
    }

    // Sort by utilisation descending
    approachingLimit.sort((a, b) => b.utilisationPct - a.utilisationPct);
    breachedLimit.sort((a, b) => b.utilisationPct - a.utilisationPct);

    // Existing dashboard method for top borrowers + rating breakdown
    const dashboard = await this.getExposureDashboard({ topN: 10 });

    return {
      totalPortfolioExposure,
      topBorrowers: dashboard.topBorrowers,
      ratingDistribution: dashboard.ratingDistribution,
      approachingLimit,
      breachedLimit,
      byProductType,
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
  /**
   * Get Approval Turnaround Report — §5.2
   *
   * For each completed application (APPROVED+ post-approval states),
   * calculates turnaround days from submittedAt to first APPROVE CreditDecision.
   * Groups by product type, month, or RM with avg/median/P90 aggregates.
   */
  async getApprovalTurnaround(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    productType?: string;
    rmId?: string;
    branchId?: string;
    groupBy?: 'product' | 'month' | 'rm';
  }): Promise<TurnaroundResult> {
    const groupBy = filters?.groupBy ?? 'month';

    // Terminal/post-approval states that have been decisioned
    const DECISIONED_STATES = ['APPROVED', 'REJECTED', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED'];

    // Build where clause for applications
    const where: any = {
      state: { in: DECISIONED_STATES },
      submittedAt: { not: null },
      deletedAt: null,
    };

    if (filters?.dateFrom || filters?.dateTo) {
      where.submittedAt = { not: null };
      if (filters.dateFrom) where.submittedAt.gte = filters.dateFrom;
      if (filters.dateTo) where.submittedAt.lte = filters.dateTo;
    }
    if (filters?.productType) where.productType = filters.productType;
    if (filters?.rmId) where.assignedRmId = filters.rmId;
    if (filters?.branchId) where.branchId = filters.branchId;

    // Fetch relevant applications with their APPROVE decisions
    const applicationsRaw = await prisma.creditApplication.findMany({
      where,
      select: {
        id: true,
        applicationNo: true,
        productType: true,
        submittedAt: true,
        assignedRmId: true,
        borrowerProfile: {
          select: {
            name: true,
            account: { select: { name: true } },
            contact: { select: { firstName: true, lastName: true } },
          },
        },
        assignedRm: {
          select: { id: true, firstName: true, lastName: true },
        },
        decisions: {
          where: { decisionType: 'APPROVE' },
          select: { decisionAt: true },
          orderBy: { decisionAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { submittedAt: 'desc' },
    }) as any[];

    // Calculate turnaround for each application
    const appRows: TurnaroundAppRow[] = [];

    for (const app of applicationsRaw) {
      const bp = app.borrowerProfile;
      const borrowerName = bp?.account?.name
        ?? (bp?.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : null)
        ?? bp?.name
        ?? 'Unknown';

      // Only include apps that have at least one APPROVE decision
      if (!app.decisions || app.decisions.length === 0) continue;
      if (!app.submittedAt) continue;

      const firstApprovalAt = app.decisions[0].decisionAt;
      const turnaroundDays = daysBetween(app.submittedAt, firstApprovalAt);

      appRows.push({
        applicationId: app.id,
        applicationNo: app.applicationNo,
        borrowerName,
        productType: app.productType as string,
        rmName: app.assignedRm ? `${app.assignedRm.firstName} ${app.assignedRm.lastName}` : 'Unassigned',
        submittedAt: app.submittedAt.toISOString(),
        firstApprovalAt: firstApprovalAt.toISOString(),
        turnaroundDays: Math.max(0, turnaroundDays),
      });
    }

    // Group and aggregate using raw SQL for percentile calculations
    const groupKey = groupBy === 'product' ? 'productType'
      : groupBy === 'rm' ? 'rmName'
      : 'month';

    const groups: Record<string, number[]> = {};
    for (const row of appRows) {
      let key: string;
      if (groupKey === 'month') {
        // Extract YYYY-MM from submittedAt
        key = row.submittedAt.slice(0, 7);
      } else if (groupKey === 'productType') {
        key = row.productType;
      } else {
        key = row.rmName;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(row.turnaroundDays);
    }

    function percentile(arr: number[], p: number): number {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      if (lower === upper) return sorted[lower];
      return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower]);
    }

    function avg(arr: number[]): number {
      if (arr.length === 0) return 0;
      return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
    }

    const groupResults: TurnaroundGroup[] = Object.entries(groups)
      .map(([key, days]) => ({
        key,
        label: groupKey === 'month' ? key : key,
        count: days.length,
        avgDays: avg(days),
        medianDays: Math.round(percentile(days, 50) * 10) / 10,
        p90Days: Math.round(percentile(days, 90) * 10) / 10,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // Overall aggregates
    const allDays = appRows.map(r => r.turnaroundDays);
    const overall: TurnaroundGroup = {
      key: 'overall',
      label: 'Overall',
      count: allDays.length,
      avgDays: avg(allDays),
      medianDays: Math.round(percentile(allDays, 50) * 10) / 10,
      p90Days: Math.round(percentile(allDays, 90) * 10) / 10,
    };

    return {
      applications: appRows,
      summary: {
        groupBy,
        groups: groupResults,
        overall,
      },
    };
  }
}

export const dashboardService = new DashboardService();