/**
 * P2-2: Lane Determination Service
 *
 * Determines the processing lane for a credit application based on
 * borrower type, requested amount, and annual turnover.
 *
 * Lanes:
 *   PERSONAL_FAST — INDIVIDUAL + amount ≤ RM150k: ~6 tabs, 2 approvals
 *   SME            — SOLE_PROPRIETOR or CORPORATE with turnover < RM5M: ~12 tabs, 2-eye
 *   CORPORATE      — Everything else: full flow, sign-off chain per matrix
 *
 * Thresholds are configurable via CreditPolicyLimit rows (type: LANE_THRESHOLD).
 */

import { PrismaClient, ProcessingLane, BorrowerType } from '@prisma/client';

const prisma = new PrismaClient();

// ── Default thresholds (MYR) ──────────────────────────────────────────────────
const PERSONAL_FAST_AMOUNT_CAP = 150_000;   // RM 150k
const SME_TURNOVER_CAP = 5_000_000;          // RM 5M

// ── Lane threshold config (fetched from DB) ───────────────────────────────────
export interface LaneThresholds {
  personalFastAmountCap: number;
  smeTurnoverCap: number;
}

// ── Lane determination result ─────────────────────────────────────────────────
export interface LaneDetermination {
  lane: ProcessingLane;
  reason: string;
}

/**
 * Fetch lane thresholds from CreditPolicyLimit (type: LANE_THRESHOLD).
 * Falls back to hardcoded constants if no DB rows are found or if
 * the LANE_THRESHOLD enum value hasn't been migrated yet.
 */
export async function getLaneThresholds(): Promise<LaneThresholds> {
  try {
    const rows = await prisma.creditPolicyLimit.findMany({
      where: {
        type: 'LANE_THRESHOLD',
        isActive: true,
      },
    });

    const personalCap = rows.find((r) => r.label === 'Personal Fast Amount Cap');
    const smeCap = rows.find((r) => r.label === 'SME Turnover Cap');

    return {
      personalFastAmountCap: personalCap ? Number(personalCap.maxValue) : PERSONAL_FAST_AMOUNT_CAP,
      smeTurnoverCap: smeCap ? Number(smeCap.maxValue) : SME_TURNOVER_CAP,
    };
  } catch (err: any) {
    // If the LANE_THRESHOLD enum value doesn't exist in the DB yet
    // (pre-migration), fall back to hardcoded defaults rather than crash.
    if (err?.code === '22P02' || err?.message?.includes('invalid input value')) {
      return {
        personalFastAmountCap: PERSONAL_FAST_AMOUNT_CAP,
        smeTurnoverCap: SME_TURNOVER_CAP,
      };
    }
    throw err;
  }
}

/**
 * Determine the processing lane for an application (sync, hardcoded thresholds).
 * Uses borrowerType, requestedAmount, and (for CORPORATE) annualTurnover.
 * Kept for backward compatibility.
 */
export function determineLane(
  borrowerType: BorrowerType,
  requestedAmount: number | string,
  annualTurnover?: number | string | null,
): LaneDetermination {
  const amount = typeof requestedAmount === 'string' ? parseFloat(requestedAmount) : requestedAmount;
  const turnover = annualTurnover != null
    ? (typeof annualTurnover === 'string' ? parseFloat(annualTurnover) : annualTurnover)
    : null;

  // ── PERSONAL_FAST: INDIVIDUAL + amount ≤ 150k ──
  if (borrowerType === 'INDIVIDUAL') {
    if (amount <= PERSONAL_FAST_AMOUNT_CAP) {
      return {
        lane: ProcessingLane.PERSONAL_FAST,
        reason: `Individual borrower, amount RM${amount.toLocaleString()} ≤ RM${PERSONAL_FAST_AMOUNT_CAP.toLocaleString()}`,
      };
    }
    // Above the cap → falls through to CORPORATE lane
    return {
      lane: ProcessingLane.CORPORATE,
      reason: `Individual borrower, amount RM${amount.toLocaleString()} > RM${PERSONAL_FAST_AMOUNT_CAP.toLocaleString()} threshold`,
    };
  }

  // ── SOLE_PROPRIETOR: always SME lane ──
  if (borrowerType === 'SOLE_PROPRIETOR') {
    return {
      lane: ProcessingLane.SME,
      reason: 'Sole proprietor borrower → SME lane',
    };
  }

  // ── CORPORATE: SME if turnover < RM5M, else CORPORATE ──
  if (borrowerType === 'CORPORATE') {
    if (turnover != null && turnover < SME_TURNOVER_CAP) {
      return {
        lane: ProcessingLane.SME,
        reason: `Corporate borrower, turnover RM${turnover.toLocaleString()} < RM${SME_TURNOVER_CAP.toLocaleString()} → SME lane`,
      };
    }
    if (turnover != null && turnover >= SME_TURNOVER_CAP) {
      return {
        lane: ProcessingLane.CORPORATE,
        reason: `Corporate borrower, turnover RM${turnover.toLocaleString()} ≥ RM${SME_TURNOVER_CAP.toLocaleString()} → Corporate lane`,
      };
    }
    // No turnover data → default to CORPORATE (conservative)
    return {
      lane: ProcessingLane.CORPORATE,
      reason: 'Corporate borrower, no turnover data → Corporate lane (default)',
    };
  }

  // ── JOINT: always CORPORATE lane ──
  return {
    lane: ProcessingLane.CORPORATE,
    reason: 'Joint borrower → Corporate lane',
  };
}

/**
 * Async version of determineLane that fetches thresholds from the database
 * via CreditPolicyLimit before computing the lane.
 * Falls back to hardcoded defaults if DB query fails.
 */
export async function determineLaneWithConfig(
  borrowerType: BorrowerType,
  requestedAmount: number | string,
  annualTurnover?: number | string | null,
): Promise<LaneDetermination> {
  const thresholds = await getLaneThresholds();
  return determineLaneWithThresholds(borrowerType, requestedAmount, annualTurnover, thresholds);
}

/**
 * Core lane determination logic with explicit thresholds.
 * Used by both sync (determineLane) and async (determineLaneWithConfig) paths.
 */
export function determineLaneWithThresholds(
  borrowerType: BorrowerType,
  requestedAmount: number | string,
  annualTurnover: number | string | null | undefined,
  thresholds: LaneThresholds,
): LaneDetermination {
  const amount = typeof requestedAmount === 'string' ? parseFloat(requestedAmount) : requestedAmount;
  const turnover = annualTurnover != null
    ? (typeof annualTurnover === 'string' ? parseFloat(annualTurnover) : annualTurnover)
    : null;

  const { personalFastAmountCap, smeTurnoverCap } = thresholds;

  // ── PERSONAL_FAST: INDIVIDUAL + amount ≤ cap ──
  if (borrowerType === 'INDIVIDUAL') {
    if (amount <= personalFastAmountCap) {
      return {
        lane: ProcessingLane.PERSONAL_FAST,
        reason: `Individual borrower, amount RM${amount.toLocaleString()} ≤ RM${personalFastAmountCap.toLocaleString()}`,
      };
    }
    return {
      lane: ProcessingLane.CORPORATE,
      reason: `Individual borrower, amount RM${amount.toLocaleString()} > RM${personalFastAmountCap.toLocaleString()} threshold`,
    };
  }

  // ── SOLE_PROPRIETOR: always SME lane ──
  if (borrowerType === 'SOLE_PROPRIETOR') {
    return {
      lane: ProcessingLane.SME,
      reason: 'Sole proprietor borrower → SME lane',
    };
  }

  // ── CORPORATE: SME if turnover < cap, else CORPORATE ──
  if (borrowerType === 'CORPORATE') {
    if (turnover != null && turnover < smeTurnoverCap) {
      return {
        lane: ProcessingLane.SME,
        reason: `Corporate borrower, turnover RM${turnover.toLocaleString()} < RM${smeTurnoverCap.toLocaleString()} → SME lane`,
      };
    }
    if (turnover != null && turnover >= smeTurnoverCap) {
      return {
        lane: ProcessingLane.CORPORATE,
        reason: `Corporate borrower, turnover RM${turnover.toLocaleString()} ≥ RM${smeTurnoverCap.toLocaleString()} → Corporate lane`,
      };
    }
    // No turnover data → default to CORPORATE (conservative)
    return {
      lane: ProcessingLane.CORPORATE,
      reason: 'Corporate borrower, no turnover data → Corporate lane (default)',
    };
  }

  // ── JOINT: always CORPORATE lane ──
  return {
    lane: ProcessingLane.CORPORATE,
    reason: 'Joint borrower → Corporate lane',
  };
}

// ── Lane-specific tab configuration ───────────────────────────────────────────

/** Core tabs visible in ALL lanes */
const CORE_TABS: string[] = [
  'loan-request',
  'borrower-profile',
  'financials',
  'credit-checks',
  'signoff',
  'documents',
];

/** Tabs added for SME lane (on top of core) */
const SME_EXTRA_TABS: string[] = [
  'collateral',
  'security-guarantees',
  'conditions',
  'payment-capability',
  'risk-score',
];

/** Tabs exclusive to SME lane (not inherited by CORPORATE) */
const SME_ONLY_TABS: string[] = [
  'sme-financials',  // P2-3: SME simplified financials tab
];

/** Tabs added for CORPORATE lane (on top of SME) */
const CORPORATE_EXTRA_TABS: string[] = [
  'parties',
  'industry',
  'guarantor-assessment',
  'approvals',
  'audit',
];

/**
 * Get the ordered list of tab IDs for a given lane, filtered by feature flags.
 * Feature flags is a Record<string, boolean> from useCreditFeatureFlags / public endpoint.
 */
export function getLaneTabs(
  lane: ProcessingLane | string,
  featureFlags: Record<string, boolean> = {},
): string[] {
  const isFeatureEnabled = (key: string) => featureFlags[key] ?? false;

  const tabs: string[] = [...CORE_TABS];

  if (lane === 'SME' || lane === 'CORPORATE') {
    tabs.push(...SME_EXTRA_TABS);
  }

  if (lane === 'SME') {
    tabs.push(...SME_ONLY_TABS);
  }

  if (lane === 'CORPORATE') {
    tabs.push(...CORPORATE_EXTRA_TABS);
  }

  // Add advanced tabs if their feature flags are enabled
  if (isFeatureEnabled('credit:ecl')) tabs.push('risk-rating');
  if (isFeatureEnabled('credit:profitability')) tabs.push('profitability');
  if (isFeatureEnabled('credit:counterparties')) tabs.push('counterparties');
  if (isFeatureEnabled('credit:account_conduct')) tabs.push('conduct');
  if (isFeatureEnabled('credit:esg')) tabs.push('forward-looking-risk');
  if (isFeatureEnabled('credit:advanced_memo')) {
    tabs.push('header');
    tabs.push('facilities');
  }

  // Always add summary (disbursement is state-gated in frontend)
  tabs.push('summary');

  return tabs;
}

// ── Lane-aware approval depth ─────────────────────────────────────────────────

/**
 * Get the required approver count for a given lane.
 * Returns -1 for CORPORATE to signal "use approval matrix" (dynamic depth).
 */
export function getRequiredApproverCount(lane: ProcessingLane | string): number {
  switch (lane) {
    case 'PERSONAL_FAST':
      return 2; // 1 officer + 1 approver
    case 'SME':
      return 2; // 2-eye approval
    case 'CORPORATE':
      return -1; // Use approval matrix
    default:
      return -1;
  }
}

// ── Persist lane to application ────────────────────────────────────────────────

/**
 * Re-evaluate and persist the lane for a given application.
 * Called after creation and after borrower profile / amount changes.
 * Now uses DB-configurable thresholds via determineLaneWithConfig().
 */
export async function persistLane(
  applicationId: string,
): Promise<LaneDetermination> {
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          borrowerType: true,
          annualTurnover: true,
        },
      },
    },
  });

  if (!app) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const determination = await determineLaneWithConfig(
    app.borrowerProfile?.borrowerType ?? 'CORPORATE',
    app.requestedAmount.toString(),
    app.borrowerProfile?.annualTurnover?.toString() ?? null,
  );

  await prisma.creditApplication.update({
    where: { id: applicationId },
    data: { lane: determination.lane },
  });

  return determination;
}