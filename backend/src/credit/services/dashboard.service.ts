import prisma from '../../utils/prisma';
import { ApplicationState, CommitteeMeetingStatus } from '@prisma/client';
import { formatCurrency } from '../utils/formatCurrency';
import { approvalMatrixService } from './approvalMatrix.service';
import { getUserAuthorityLevel, AUTHORITY_HIERARCHY } from './approvalAction.service';

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
  // Phase 2 additions
  requestedAmount: number | null;
  riskGrade: string | null;
  slaStatus: 'OK' | 'WARNING' | 'OVERDUE';
  entityType: string | null;
  // Dashboard cockpit additions
  slaRemainingHours: number | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
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
  excluded: { applicationId: string; borrowerName: string; reason: string }[];
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
  decision: string; // 'APPROVE' | 'REJECT'
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
// §Dashboard Cockpit — Work Queue / Alerts / Activity / Team Performance
// ---------------------------------------------------------------------------

export type WorkQueueBucketKey =
  | 'pendingReview'
  | 'inProgress'
  | 'pendingDocs'
  | 'returned'
  | 'overdue'
  | 'pendingApproval';

export interface WorkQueueBucket {
  key: WorkQueueBucketKey;
  label: string;
  count: number;
  slaCompliancePct: number | null; // null = no SLA policy for this bucket
  states: string[];
}

export interface WorkQueueResult {
  buckets: WorkQueueBucket[];
  totalApplications: number;
}

export interface DashboardAlerts {
  highDsr: { count: number; thresholdPct: number; filterUrl: string };
  expiredBureau: { count: number; maxAgeDays: number; filterUrl: string };
  amlReview: { count: number; filterUrl: string };
}

export interface ActivityFeedItem {
  id: string;
  applicationId: string;
  applicationNo: string;
  eventType: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  newState: string | null;
  createdAt: string;
}

export interface ActivityFeedResult {
  items: ActivityFeedItem[];
  total: number;
  page: number;
  limit: number;
}

export interface TeamPerformanceResult {
  slaCompliancePct: number;
  avgApprovalTurnaroundDays: number | null;
  bottleneckStage: { state: string; avgDays: number; pctSlowerThanAvg: number } | null;
  totalDecisions: number;
}

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
// §Dashboard Cockpit — Priority derivation (no schema column)
// ---------------------------------------------------------------------------

/** Derive application priority from lane + amount band + SLA proximity. */
export function derivePriority(app: {
  lane: string;
  requestedAmount: number;
  slaStatus: 'OK' | 'WARNING' | 'OVERDUE';
}): 'HIGH' | 'MEDIUM' | 'LOW' {
  // SLA breach or warning always dominates
  if (app.slaStatus === 'OVERDUE') return 'HIGH';
  if (app.slaStatus === 'WARNING') return 'MEDIUM';

  // Amount bands (MYR)
  const HIGH_AMOUNT = 5_000_000;
  const MED_AMOUNT = 1_000_000;
  if (app.requestedAmount >= HIGH_AMOUNT) return 'HIGH';
  if (app.lane === 'SME' && app.requestedAmount >= MED_AMOUNT) return 'MEDIUM';
  if (app.lane === 'CORPORATE' && app.requestedAmount >= MED_AMOUNT) return 'MEDIUM';
  if (app.requestedAmount >= MED_AMOUNT) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// §Dashboard Cockpit — State → operational bucket mapping
// ---------------------------------------------------------------------------

const BUCKET_MAP: Record<WorkQueueBucketKey, string[]> = {
  pendingReview: ['SUBMITTED', 'KYC_REVIEW'],
  inProgress: ['UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'KYC_APPROVED', 'CONDITION_FULFILMENT'],
  pendingDocs: ['COMPLIANCE_HOLD'],
  returned: ['REFERRED_BACK'],
  overdue: [], // populated dynamically from SLA breaches
  pendingApproval: [], // populated dynamically from approval-inbox count
};

const BUCKET_LABELS: Record<WorkQueueBucketKey, string> = {
  pendingReview: 'Pending Review',
  inProgress: 'In Progress',
  pendingDocs: 'Pending Docs',
  returned: 'Returned',
  overdue: 'Overdue',
  pendingApproval: 'Pending Appr',
};

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
    const stateMap = new Map<string, { count: number; totalDays: number }>();

    for (const app of applications) {
      const st = app.state as string;
      const entry = stateMap.get(st) ?? { count: 0, totalDays: 0 };
      entry.count++;

      // Calculate days in current state using updatedAt for time in current state
      // TODO: Track state-change timestamps via audit events for more accuracy
      const refDate = app.updatedAt ?? app.createdAt;
      const daysInState = daysBetween(refDate, new Date());
      entry.totalDays += Math.max(0, daysInState);

      stateMap.set(st, entry);
    }

    const states: PipelineStateCount[] = Array.from(stateMap.entries()).map(([state, data]) => ({
      state,
      count: data.count,
      avgDaysInState: data.count > 0 ? Math.round((data.totalDays / data.count) * 10) / 10 : 0,
    }));

    // Build application-level filter for SLA breach queries (branch + date)
    const applicationFilter: any = { deletedAt: null };
    if (filters?.branchId) applicationFilter.branchId = filters.branchId;
    if (filters?.dateFrom || filters?.dateTo) {
      applicationFilter.createdAt = {};
      if (filters.dateFrom) applicationFilter.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) applicationFilter.createdAt.lte = filters.dateTo;
    }

    // SLA breach count — single-sourced from CreditSlaBreach table (authoritative)
    const slaBreachCount = await prisma.creditSlaBreach.count({
      where: {
        resolvedAt: null,
        application: applicationFilter,
      },
    });

    // Fetch itemized SLA breaches from the CreditSlaBreach table (authoritative source)
    const activeBreaches = await prisma.creditSlaBreach.findMany({
      where: {
        resolvedAt: null,
        application: applicationFilter,
      },
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
                industry: true,
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
      const borrowerName = bp?.name ?? 'Unknown';
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
      requestedAmount: true,
      lane: true,
      createdAt: true,
      borrowerProfile: {
        select: {
          id: true,
          name: true,
          borrowerType: true,
          creditRiskRating: true,
          industry: true,
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
        application: { select: { id: true, applicationNo: true, state: true, borrowerProfile: { select: { id: true, name: true, industry: true } } } },
        policy: { select: { name: true } },
      },
    });

    const breachedAppIds = new Set(myBreaches.map(b => b.application.id));

    const toMyWorkItem = (app: any): MyWorkItem => {
      const bp = app.borrowerProfile;
      const borrowerName = bp?.name ?? 'Unknown';

      const slaStatus: 'OK' | 'WARNING' | 'OVERDUE' = breachedAppIds.has(app.id)
        ? 'OVERDUE'
        : 'OK';

      // Derive SLA remaining hours from the SLA due date
      let slaRemainingHours: number | null = null;
      // We compute this inline from the SLA service on demand — but to avoid
      // N+1 queries we use a simpler heuristic: if breached, remaining = 0;
      // otherwise we estimate from createdAt + slaHours (fetched per-bucket above).
      // For the cockpit table we set it to null if no SLA policy applies.
      if (slaStatus === 'OVERDUE') {
        slaRemainingHours = 0;
      }

      const requestedAmount = app.requestedAmount != null ? Number(app.requestedAmount) : 0;
      const priority = derivePriority({
        lane: app.lane ?? 'CORPORATE',
        requestedAmount,
        slaStatus,
      });

      return {
        id: app.id,
        applicationNo: app.applicationNo ?? '',
        state: app.state as string,
        borrowerName,
        productType: app.productType ?? '',
        updatedAt: app.updatedAt.toISOString(),
        requestedAmount: app.requestedAmount != null ? Number(app.requestedAmount) : null,
        riskGrade: app.riskRating ?? bp?.creditRiskRating ?? null,
        slaStatus,
        entityType: bp?.borrowerType ?? null,
        slaRemainingHours,
        priority,
      };
    };

    const mySlaBreachItems: SlaBreachItem[] = myBreaches.map(b => {
      const bp = (b as any).application?.borrowerProfile;
      const borrowerName = bp?.name ?? 'Unknown';
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
   *  - (F6) user has credit:approve permission AND sufficient authority level
   */
  async getApprovalInbox(userId: string, userRoles: string[], userPermissions: string[], _filters?: {
    urgency?: 'HIGH' | 'MEDIUM' | 'LOW';
    page?: number;
    limit?: number;
  }): Promise<ApprovalInboxResult> {
    // F6 — Early-return empty inbox if user lacks credit:approve permission
    if (!userPermissions.includes('credit:approve')) {
      return { high: [], medium: [], low: [], totalPending: 0, excluded: [] };
    }

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
        borrowerProfile: { select: { id: true, creditRiskRating: true, name: true, industry: true } },
        decisions: {
          where: { decisionById: userId },
          select: { id: true },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Also find applications in approval-pending states where the user has NOT yet decided
    // (i.e., they are eligible approvers but haven't acted)
    // LOS-020 — Removed assignedRmId: { not: userId } from the query; SOD exclusion
    // is now recorded in the loop so the UI can explain why a case is absent.
    const appsWithoutDecision = await prisma.creditApplication.findMany({
      where: {
        state: { in: APPROVAL_PENDING_STATES },
        deletedAt: null,
        NOT: {
          decisions: {
            some: { decisionById: userId },
          },
        },
      },
      include: {
        borrowerProfile: { select: { id: true, creditRiskRating: true, name: true, industry: true } },
        decisions: { select: { id: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Resolve the user's highest authority level once
    const userAuthLevel = getUserAuthorityLevel(userRoles);

    // Merge and deduplicate
    const seenIds = new Set<string>();
    const allItems: ApprovalInboxItem[] = [];
    const excluded: { applicationId: string; borrowerName: string; reason: string }[] = [];

    for (const app of [...applications, ...appsWithoutDecision]) {
      if (seenIds.has(app.id)) continue;
      seenIds.add(app.id);

      const borrowerName = (app.borrowerProfile as any)?.name ?? (app.borrowerProfile as any)?.account?.name ?? 'Unknown';

      // LOS-020 — SOD exclusion: user is the assigned RM on this application
      if (app.assignedRmId === userId) {
        excluded.push({ applicationId: app.id, borrowerName, reason: 'Segregation of duties — you are the assigned RM on this application.' });
        continue;
      }

      // Skip if user already submitted a decision (from first query)
      const alreadyDecided = app.decisions.length > 0;
      if (alreadyDecided) {
        excluded.push({ applicationId: app.id, borrowerName, reason: 'You have already submitted a decision on this application.' });
        continue;
      }

      // F6 — Scope to actual authority: resolve required authority via matrix lookup
      // and keep only apps the user's authority level can approve
      const exposure = Number((app as any).requestedAmount) || 0;
      const riskRating = (app as any).riskRating ?? (app.borrowerProfile as any)?.creditRiskRating ?? 'NR';
      const branchId = (app as any).branchId ?? null;
      const authorityResult = await approvalMatrixService.lookupApprovalAuthority(
        exposure,
        riskRating,
        branchId,
        (app as any).lane ?? null,
      );
      if (authorityResult) {
        const requiredLevel = AUTHORITY_HIERARCHY[authorityResult.authorityLevel] ?? 0;
        if (userAuthLevel < requiredLevel) {
          excluded.push({ applicationId: app.id, borrowerName, reason: `Requires ${authorityResult.authorityLevel} authority, which is above your approval level.` });
          continue; // user lacks sufficient authority
        }
      }
      // If no matrix match, allow through (no matrix restriction applies)

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
      excluded,
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
      select: {
        id: true,
        name: true,
        industry: true,
        creditRiskRating: true,
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
          },
        },
      },
    });

    // Aggregate exposure per borrower
    // TODO: Replace with DB-level aggregation (Prisma groupBy + _sum) for production scale
    const borrowerExposures: ExposureByBorrower[] = borrowers.map(bp => {
      const borrowerName = bp.name ?? 'Unknown';
      const industry = bp.industry ?? null;
      const rating = (bp.applications.find(app => app.riskRating)?.riskRating as string | null)
        ?? bp.creditRiskRating
        ?? null;

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

    const RATING_ORDER = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR'];

    const ratingDistribution: RatingDistribution[] = Array.from(ratingMap.entries())
      .map(([rating, data]) => ({ rating, ...data }))
      .sort((a, b) => {
        const ai = RATING_ORDER.indexOf(a.rating);
        const bi = RATING_ORDER.indexOf(b.rating);
        return (ai === -1 ? RATING_ORDER.length : ai) - (bi === -1 ? RATING_ORDER.length : bi);
      });

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
  async getExposureSummary(filters?: { rmId?: string; borrowerGroupId?: string; riskRating?: string; branchId?: string }) {
    // Build borrower filter
    const where: any = { isActive: true, deletedAt: null };
    if (filters?.rmId) where.relationshipManagerId = filters.rmId;
    if (filters?.riskRating) {
      where.OR = [
        { applications: { some: { deletedAt: null, riskRating: filters.riskRating as any } } },
        { creditRiskRating: filters.riskRating },
      ];
    }
    if (filters?.branchId) where.branchId = filters.branchId;

    const borrowers = await prisma.borrowerProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        industry: true,
        creditRiskRating: true,
        exposureLimit: true,
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
      const borrowerName = bp.name ?? 'Unknown';
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
    const dashboard = await this.getExposureDashboard({ topN: 10, branchId: filters?.branchId });

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

    // Fetch relevant applications with their first final decision (APPROVE or REJECT)
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
          },
        },
        assignedRm: {
          select: { id: true, firstName: true, lastName: true },
        },
        decisions: {
          where: { decisionType: { in: ['APPROVE', 'REJECT'] } },
          select: { decisionType: true, decisionAt: true },
          orderBy: { decisionAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { submittedAt: 'desc' },
    }) as any[];

    // Calculate turnaround for each application — include both APPROVE and REJECT
    const appRows: TurnaroundAppRow[] = [];

    for (const app of applicationsRaw) {
      const bp = app.borrowerProfile;
      const borrowerName = bp?.name ?? 'Unknown';

      // Only include apps that have at least one final decision (APPROVE or REJECT)
      if (!app.decisions || app.decisions.length === 0) continue;
      if (!app.submittedAt) continue;

      // Defense-in-depth: pick the first APPROVE or REJECT decision, even if
      // the Prisma query didn't perfectly filter (e.g. in mock/tests)
      const firstFinalDecision = app.decisions.find(
        (d: any) => d.decisionType === 'APPROVE' || d.decisionType === 'REJECT',
      );
      if (!firstFinalDecision) continue;

      const firstApprovalAt = firstFinalDecision.decisionAt;
      const turnaroundDays = daysBetween(app.submittedAt, firstApprovalAt);
      const decisionType = firstFinalDecision.decisionType as string;

      appRows.push({
        applicationId: app.id,
        applicationNo: app.applicationNo,
        borrowerName,
        productType: app.productType as string,
        rmName: app.assignedRm ? `${app.assignedRm.firstName} ${app.assignedRm.lastName}` : 'Unassigned',
        submittedAt: app.submittedAt.toISOString(),
        firstApprovalAt: firstApprovalAt.toISOString(),
        turnaroundDays: Math.max(0, turnaroundDays),
        decision: decisionType,
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
      .sort((a, b) => {
        // Sort chronologically for month groups, alphabetically for others
        if (groupKey === 'month') return a.key.localeCompare(b.key);
        return a.key.localeCompare(b.key);
      });

    // Overall aggregates
    const allDays = appRows.map(r => r.turnaroundDays);
    const overall: TurnaroundGroup = {
      key: 'overall',
      label: 'Decisions',
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

  // ===========================================================================
  // §Dashboard Cockpit — Work Queue, Alerts, Activity, Team Performance
  // ===========================================================================

  /**
   * GET /credit/dashboard/work-queue
   * Returns 6 operational buckets with per-bucket SLA compliance %.
   */
  async getWorkQueue(filters?: { branchId?: string }): Promise<WorkQueueResult> {
    const where: any = { deletedAt: null };
    if (filters?.branchId) where.branchId = filters.branchId;

    // Fetch all non-deleted, non-terminal applications
    const TERMINAL_STATES = ['CLOSED', 'WITHDRAWN', 'KYC_REJECTED', 'REJECTED', 'DISBURSED', 'ACTIVE'];
    const applications = await prisma.creditApplication.findMany({
      where: { ...where, state: { notIn: TERMINAL_STATES as any[] } },
      select: { id: true, state: true },
    });

    // Count unresolved SLA breaches for Overdue bucket
    const slaBreachCount = await prisma.creditSlaBreach.count({
      where: {
        resolvedAt: null,
        application: { ...where, state: { notIn: TERMINAL_STATES as any[] } },
      },
    });

    // Count pending approvals (applications in approval-pending states)
    const pendingApprovalCount = await prisma.creditApplication.count({
      where: { ...where, state: { in: APPROVAL_PENDING_STATES } },
    });

    // Map applications to buckets
    const appIdsByBucket: Record<WorkQueueBucketKey, Set<string>> = {
      pendingReview: new Set(),
      inProgress: new Set(),
      pendingDocs: new Set(),
      returned: new Set(),
      overdue: new Set(),
      pendingApproval: new Set(),
    };

    for (const app of applications) {
      const st = app.state as string;
      if (APPROVAL_PENDING_STATES.includes(st as ApplicationState)) {
        appIdsByBucket.pendingApproval.add(app.id);
      }
      for (const key of Object.keys(BUCKET_MAP) as WorkQueueBucketKey[]) {
        if (BUCKET_MAP[key].includes(st)) {
          appIdsByBucket[key].add(app.id);
        }
      }
    }

    // Fetch SLA breach application IDs for overdue bucket
    const breachedAppIds = await prisma.creditSlaBreach.findMany({
      where: { resolvedAt: null, application: where },
      select: { applicationId: true },
    });
    for (const b of breachedAppIds) {
      appIdsByBucket.overdue.add(b.applicationId);
    }

    // Fetch per-bucket SLA compliance %
    // For each non-empty bucket, count apps with active SLA policies and check breaches
    const buckets: WorkQueueBucket[] = [];

    for (const key of Object.keys(BUCKET_MAP) as WorkQueueBucketKey[]) {
      const appIds = Array.from(appIdsByBucket[key]);
      const count = key === 'overdue'
        ? slaBreachCount
        : key === 'pendingApproval'
          ? pendingApprovalCount
          : appIds.length;

      let slaCompliancePct: number | null = null;

      if (count > 0 && key !== 'overdue' && key !== 'pendingApproval') {
        // Check SLA compliance for apps in this bucket
        const bucketStates = BUCKET_MAP[key];
        const bucketApps = applications.filter(a => bucketStates.includes(a.state as string));
        const bucketAppIds = bucketApps.map(a => a.id);

        if (bucketAppIds.length > 0) {
          const breachedInBucket = await prisma.creditSlaBreach.count({
            where: {
              resolvedAt: null,
              applicationId: { in: bucketAppIds },
            },
          });
          const totalWithSla = bucketAppIds.length;
          slaCompliancePct = totalWithSla > 0
            ? Math.round(((totalWithSla - breachedInBucket) / totalWithSla) * 1000) / 10
            : null;
        }
      }

      // Overdue bucket: compliance is inverse (0% = all breached)
      if (key === 'overdue' && count > 0) {
        slaCompliancePct = 0;
      }

      buckets.push({
        key,
        label: BUCKET_LABELS[key],
        count,
        slaCompliancePct,
        states: key === 'overdue' ? [] : key === 'pendingApproval' ? APPROVAL_PENDING_STATES.map(s => s as string) : BUCKET_MAP[key],
      });
    }

    return {
      buckets,
      totalApplications: applications.length,
    };
  }

  /**
   * GET /credit/dashboard/alerts
   * Returns counts for 3 alert tiles: High DSR, Expired Bureau, AML Review.
   */
  async getDashboardAlerts(filters?: { branchId?: string }): Promise<DashboardAlerts> {
    const DSR_THRESHOLD_PCT = 60; // BNM guideline threshold
    const BUREAU_MAX_AGE_DAYS = 30;

    const appWhere: any = { deletedAt: null };
    if (filters?.branchId) appWhere.branchId = filters.branchId;

    // High DSR — borrowers with active credit profiles where dsrPercent >= threshold
    // and who have active (non-terminal) applications
    const activeApps = await prisma.creditApplication.findMany({
      where: { ...appWhere, state: { notIn: ['CLOSED', 'WITHDRAWN', 'REJECTED', 'KYC_REJECTED', 'DISBURSED', 'ACTIVE'] as any[] } },
      select: { borrowerProfileId: true },
      distinct: ['borrowerProfileId'],
    });
    const activeBorrowerIds = activeApps.map(a => a.borrowerProfileId);

    let highDsrCount = 0;
    if (activeBorrowerIds.length > 0) {
      const creditProfiles = await prisma.borrowerCreditProfile.findMany({
        where: {
          borrowerId: { in: activeBorrowerIds },
          dsrPercent: { gte: DSR_THRESHOLD_PCT },
        },
        select: { id: true },
      });
      highDsrCount = creditProfiles.length;
    }

    // Expired Bureau — CreditBureauCheck where ccrisReportDate or ctosReportDate > 30 days old
    let expiredBureauCount = 0;
    if (activeBorrowerIds.length > 0) {
      const activeAppIds = await prisma.creditApplication.findMany({
        where: { ...appWhere, state: { notIn: ['CLOSED', 'WITHDRAWN', 'REJECTED', 'KYC_REJECTED'] as any[] } },
        select: { id: true },
      });
      const appIds = activeAppIds.map(a => a.id);

      if (appIds.length > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - BUREAU_MAX_AGE_DAYS);

        const expiredChecks = await prisma.creditBureauCheck.findMany({
          where: {
            applicationId: { in: appIds },
            OR: [
              { ccrisReportDate: { lt: cutoffDate } },
              { ctosReportDate: { lt: cutoffDate } },
            ],
          },
          select: { id: true },
        });
        expiredBureauCount = expiredChecks.length;
      }
    }

    // AML Review — AmlRescreenEvents with outcome POTENTIAL_HIT or CONFIRMED_HIT that are not reviewed
    let amlReviewCount = 0;
    if (activeBorrowerIds.length > 0) {
      const amlEvents = await prisma.amlRescreenEvent.findMany({
        where: {
          borrowerProfileId: { in: activeBorrowerIds },
          outcome: { in: ['POTENTIAL_HIT', 'CONFIRMED_HIT'] },
          reviewedAt: null,
        },
        select: { id: true },
      });
      amlReviewCount = amlEvents.length;
    }

    const filterBase = filters?.branchId ? `?branchId=${filters.branchId}` : '';

    return {
      highDsr: {
        count: highDsrCount,
        thresholdPct: DSR_THRESHOLD_PCT,
        filterUrl: `/credit/applications?filter=highDsr${filterBase}`,
      },
      expiredBureau: {
        count: expiredBureauCount,
        maxAgeDays: BUREAU_MAX_AGE_DAYS,
        filterUrl: `/credit/applications?filter=expiredBureau${filterBase}`,
      },
      amlReview: {
        count: amlReviewCount,
        filterUrl: `/credit/applications?filter=amlReview${filterBase}`,
      },
    };
  }

  /**
   * GET /credit/dashboard/activity
   * Cross-application recent activity feed from CreditAuditEvent.
   * Scoped to all applications (or filtered by branch / assignedToMe).
   */
  async getActivityFeed(filters?: {
    branchId?: string;
    assignedToMe?: string;
    page?: number;
    limit?: number;
  }): Promise<ActivityFeedResult> {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters?.limit ?? 20));
    const offset = (page - 1) * limit;

    // Build application filter for joining
    const appWhere: any = { deletedAt: null };
    if (filters?.branchId) appWhere.branchId = filters.branchId;
    if (filters?.assignedToMe) {
      appWhere.OR = [
        { assignedRmId: filters.assignedToMe },
        { assignedAnalystId: filters.assignedToMe },
      ];
    }

    // Fetch audit events joined with applications matching the filter
    const [events, total] = await Promise.all([
      prisma.creditAuditEvent.findMany({
        where: {
          application: appWhere,
        },
        include: {
          application: {
            select: { applicationNo: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.creditAuditEvent.count({
        where: {
          application: appWhere,
        },
      }),
    ]);

    // Resolve actor names in bulk
    const actorIds = [...new Set(events.map(e => e.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const actorMap = new Map(actors.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    const items: ActivityFeedItem[] = events.map(e => ({
      id: e.id,
      applicationId: e.applicationId,
      applicationNo: e.application?.applicationNo ?? '',
      eventType: e.eventType,
      action: e.action,
      actorId: e.actorId,
      actorName: e.actorId ? actorMap.get(e.actorId) ?? null : null,
      newState: e.newState,
      createdAt: e.createdAt.toISOString(),
    }));

    return { items, total, page, limit };
  }

  /**
   * GET /credit/dashboard/team-performance
   * SLA compliance %, avg approval turnaround, bottleneck stage.
   */
  async getTeamPerformance(filters?: {
    branchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<TeamPerformanceResult> {
    const appWhere: any = { deletedAt: null };
    if (filters?.branchId) appWhere.branchId = filters.branchId;

    // SLA compliance — total non-terminal apps vs unresolved breaches
    const totalActiveApps = await prisma.creditApplication.count({
      where: { ...appWhere, state: { notIn: ['CLOSED', 'WITHDRAWN', 'REJECTED', 'KYC_REJECTED', 'DISBURSED', 'ACTIVE'] as any[] } },
    });
    const totalBreaches = await prisma.creditSlaBreach.count({
      where: { resolvedAt: null, application: appWhere },
    });
    const slaCompliancePct = totalActiveApps > 0
      ? Math.round(((totalActiveApps - totalBreaches) / totalActiveApps) * 1000) / 10
      : 100;

    // Avg approval turnaround — reuse getApprovalTurnaround
    const turnaround = await this.getApprovalTurnaround({
      branchId: filters?.branchId,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
      groupBy: 'month',
    });
    const avgTurnaroundDays = turnaround.summary.overall.count > 0
      ? turnaround.summary.overall.avgDays
      : null;

    // Bottleneck — find the state with the highest avg days in state vs overall avg
    const pipeline = await this.getPipelineDashboard({ branchId: filters?.branchId });
    const allAvgDays = pipeline.states.map(s => s.avgDaysInState).filter(d => d > 0);
    const overallAvg = allAvgDays.length > 0
      ? allAvgDays.reduce((a, b) => a + b, 0) / allAvgDays.length
      : 0;

    let bottleneck: { state: string; avgDays: number; pctSlowerThanAvg: number } | null = null;
    for (const s of pipeline.states) {
      if (s.avgDaysInState <= 0) continue;
      if (s.avgDaysInState > overallAvg) {
        const pctSlower = overallAvg > 0
          ? Math.round(((s.avgDaysInState - overallAvg) / overallAvg) * 100)
          : 0;
        if (!bottleneck || s.avgDaysInState > bottleneck.avgDays) {
          bottleneck = {
            state: s.state,
            avgDays: s.avgDaysInState,
            pctSlowerThanAvg: pctSlower,
          };
        }
      }
    }

    return {
      slaCompliancePct,
      avgApprovalTurnaroundDays: avgTurnaroundDays,
      bottleneckStage: bottleneck,
      totalDecisions: turnaround.summary.overall.count,
    };
  }
}

export const dashboardService = new DashboardService();