import prisma from '../utils/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ItsmPolicyExplanation {
  type: 'itsm';
  requestId: string;
  referenceNumber: string;
  requestSummary: string;
  currentUserId: string;
  approvals: Array<{
    approvalId: string;
    approverType: string;
    approverId: string | null;
    approverName: string | null;
    entityId: string | null;
    entityName: string | null;
    status: string;
    reason: string;
  }>;
  routingRules: Array<{
    ruleId: string;
    requestTypeName: string;
    routingMode: string;
    customFieldKey: string | null;
    label: string | null;
  }>;
  summary: string;
}

export interface CreditPolicyExplanation {
  type: 'credit';
  applicationId: string;
  applicationNo: string;
  currentUserId: string;
  state: string;
  requestedAmount: string;
  productType: string;
  borrowerRiskRating: string | null;
  borrowerTotalExposure: string | null;
  authorityLevel: string | null;
  requiredApproverCount: number;
  matrixName: string | null;
  decisions: Array<{
    decisionId: string;
    decisionType: string;
    decidedById: string;
    decidedByName: string | null;
    authorityLevel: string | null;
    comments: string | null;
    createdAt: string;
  }>;
  signoffs: Array<{
    signoffId: string;
    role: string;
    signedById: string;
    signedByName: string | null;
    designationSnapshot: string;
    signedAt: string | null;
  }>;
  explanation: string;
}

export type PolicyExplanation = ItsmPolicyExplanation | CreditPolicyExplanation;

// ---------------------------------------------------------------------------
// ITSM Policy Explanation
// ---------------------------------------------------------------------------

async function explainItsmPolicy(requestId: string, currentUserId: string): Promise<ItsmPolicyExplanation> {
  // Fetch the request with its approvals, requester info, and type
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      referenceNumber: true,
      summary: true,
      requestTypeId: true,
      requesterId: true,
      customFields: true,
      approvals: {
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
          entity: { select: { id: true, name: true, code: true, approverId: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }

  // Fetch routing rules for the request type
  const routingRules = request.requestTypeId
    ? await prisma.requestTypeEntityRouting.findMany({
        where: { requestTypeId: request.requestTypeId, isActive: true },
        include: { requestType: { select: { id: true, name: true } } },
      })
    : [];

  // Fetch requester entity info
  const requester = await prisma.user.findUnique({
    where: { id: request.requesterId },
    select: { id: true, firstName: true, lastName: true, entityId: true, entity: { select: { id: true, name: true, code: true } } },
  });

  // Build explanations for each approval
  const approvals = request.approvals.map((a) => {
    let reason = '';

    if (a.approverType === 'CEO') {
      reason = 'This request has been escalated to the CEO for final approval.';
    } else if (a.approverType === 'HIRING_MANAGER') {
      reason = `You are the hiring manager (original requester) for this request, and candidate review is required from you.`;
    } else if (a.approverType === 'ENTITY') {
      // Find which routing rule led to this
      const matchingRule = routingRules.find((r) => {
        if (r.routingMode === 'REQUESTER_ENTITY' && requester?.entityId === a.entityId) {
          return true;
        }
        return false;
      });

      if (matchingRule) {
        reason = `This request was routed to you because entity routing rule "${matchingRule.label || matchingRule.id}" uses REQUESTER_ENTITY mode — the requester belongs to entity "${a.entity?.name || a.entityId}", and you are the designated approver for that entity.`;
      } else {
        // Check custom field routing
        const customFields = request.customFields as Record<string, any> | null;
        const cfRules = routingRules.filter((r) => r.routingMode === 'CUSTOM_FIELD');
        const matchedCfRule = cfRules.find((r) => {
          const val = customFields?.[r.customFieldKey || ''];
          if (val) {
            // The entity code from custom field should match the entity
            return true;
          }
          return false;
        });

        if (matchedCfRule) {
          reason = `This request was routed to you because entity routing rule "${matchedCfRule.label || matchedCfRule.id}" uses CUSTOM_FIELD mode (key: "${matchedCfRule.customFieldKey}"), which resolved to entity "${a.entity?.name || a.entityId}", and you are the designated approver for that entity.`;
        } else {
          reason = `You are the designated approver for entity "${a.entity?.name || a.entityId || 'unknown'}". This request was routed to you via entity-based approval routing.`;
        }
      }
    } else {
      reason = `This request has been assigned to you for approval (approver type: ${a.approverType}).`;
    }

    return {
      approvalId: a.id,
      approverType: a.approverType,
      approverId: a.approverId,
      approverName: a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : null,
      entityId: a.entityId,
      entityName: a.entity?.name ?? null,
      status: a.status,
      reason,
    };
  });

  // Build the routing rules info
  const rules = routingRules.map((r) => ({
    ruleId: r.id,
    requestTypeName: (r as any).requestType?.name || 'Unknown',
    routingMode: r.routingMode,
    customFieldKey: r.customFieldKey,
    label: r.label,
  }));

  // Filter to only approvals relevant to the current user
  const userApprovals = approvals.filter((a) => a.approverId === currentUserId);

  let summary: string;
  if (userApprovals.length === 0) {
    summary = 'You do not have any pending approvals for this request.';
  } else if (userApprovals.length === 1) {
    summary = userApprovals[0].reason;
  } else {
    summary = `You have ${userApprovals.length} approval assignments for this request. ${userApprovals.map((a) => a.reason).join(' ')}`;
  }

  return {
    type: 'itsm',
    requestId: request.id,
    referenceNumber: request.referenceNumber,
    requestSummary: request.summary,
    currentUserId,
    approvals,
    routingRules: rules,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Credit Policy Explanation
// ---------------------------------------------------------------------------

async function explainCreditPolicy(applicationId: string, currentUserId: string): Promise<CreditPolicyExplanation> {
  // Fetch application with borrower profile and decisions
  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      applicationNo: true,
      state: true,
      requestedAmount: true,
      productType: true,
      preparedAt: true,
      reviewedAt: true,
      concurredAt: true,
      borrowerProfile: {
        select: { creditRiskRating: true, totalExposure: true },
      },
      decisions: {
        include: {
          decidedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!application) {
    throw Object.assign(new Error('Credit application not found'), { statusCode: 404 });
  }

  // Fetch signoffs
  const signoffs = await prisma.applicationSignoff.findMany({
    where: { applicationId },
    include: {
      signedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { signedAt: 'asc' },
  });

  // Resolve approval authority from matrix
  const borrowerRating = (application.borrowerProfile as any)?.creditRiskRating ?? 'NR';
  const totalExposure = Number((application.borrowerProfile as any)?.totalExposure ?? application.requestedAmount);

  let authorityResult: {
    authorityLevel: string;
    requiredApproverCount: number;
    matrixId: string;
    matrixName: string;
  } | null = null;

  try {
    // Use the existing service for a proper lookup
    const { approvalMatrixService } = await import('../credit/services/approvalMatrix.service');
    authorityResult = await approvalMatrixService.lookupApprovalAuthority(totalExposure, borrowerRating as string, null, null);
  } catch {
    // If lookup fails, authority result stays null — we just report no matrix match
  }

  const authorityLevel = authorityResult?.authorityLevel ?? null;
  const requiredApproverCount = authorityResult?.requiredApproverCount ?? 1;
  const matrixName = authorityResult?.matrixName ?? null;

  // Build decisions info - use explicit type to handle Prisma include+scalar intersection
  const decisions = application.decisions.map((d: any) => ({
    decisionId: d.id,
    decisionType: d.decisionType,
    decidedById: d.decisionById,
    decidedByName: d.decidedBy ? `${d.decidedBy.firstName} ${d.decidedBy.lastName}` : null,
    authorityLevel: d.authorityLevel,
    comments: d.comments,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
  }));

  // Build signoffs info
  const signoffData = signoffs.map((s) => ({
    signoffId: s.id,
    role: s.role,
    signedById: s.signedById,
    signedByName: `${(s.signedBy as any).firstName} ${(s.signedBy as any).lastName}`,
    designationSnapshot: s.designationSnapshot,
    signedAt: s.signedAt?.toISOString() ?? null,
  }));

  // Check if the current user has made a decision or signed off
  const userDecisions = decisions.filter((d) => d.decidedById === currentUserId);
  const userSignoffs = signoffData.filter((s) => s.signedById === currentUserId);

  // Build explanation
  const explanations: string[] = [];

  if (authorityResult) {
    const roleLabels: Record<string, string> = {
      RM: 'Relationship Manager',
      MANAGER: 'Credit Manager',
      COMMITTEE: 'Credit Committee',
      BOARD: 'Board / Risk Committee',
      // Legacy aliases (remove after full DB migration)
      CREDIT_RM: 'Relationship Manager',
      CREDIT_MANAGER: 'Credit Manager',
      SENIOR_CREDIT_OFFICER: 'Senior Credit Officer',
      CREDIT_COMMITTEE: 'Credit Committee',
      BOARD_RISK_COMMITTEE: 'Board Risk Committee',
    };
    const friendlyLevel = authorityLevel ? (roleLabels[authorityLevel] || authorityLevel) : 'Unknown';

    explanations.push(
      `This application requires "${friendlyLevel}" level approval based on approval matrix "${matrixName ?? 'N/A'}", because the total exposure (MYR ${totalExposure.toLocaleString()}) and borrower risk rating (${borrowerRating ?? 'NR'}) fall within the matrix criteria. ${requiredApproverCount > 1 ? `${requiredApproverCount} approvals are required at this level.` : '1 approval is required at this level.'}`,
    );
  } else {
    explanations.push('No matching approval matrix rule was found for this application\'s exposure and risk rating.');
  }

  if (userDecisions.length > 0) {
    explanations.push(`You have already submitted a ${userDecisions[0].decisionType} decision for this application.`);
  }

  if (userSignoffs.length > 0) {
    const roles = userSignoffs.map((s) => s.role.replace('_', ' ').toLowerCase()).join(', ');
    explanations.push(`You have signed off as: ${roles}.`);
  } else {
    // Determine which signoff role might apply to the current user
    const pendingSignoffRoles: string[] = [];
    if (!application.preparedAt) pendingSignoffRoles.push('PREPARED_BY');
    if (application.preparedAt && !application.reviewedAt) pendingSignoffRoles.push('REVIEWED_BY');
    if (application.reviewedAt && !application.concurredAt) pendingSignoffRoles.push('CONCURRED_BY');

    if (pendingSignoffRoles.length > 0) {
      explanations.push(`Pending sign-off roles: ${pendingSignoffRoles.join(', ')}.`);
    }
  }

  return {
    type: 'credit',
    applicationId: application.id,
    applicationNo: application.applicationNo,
    currentUserId,
    state: application.state,
    requestedAmount: application.requestedAmount.toString(),
    productType: application.productType,
    borrowerRiskRating: borrowerRating,
    borrowerTotalExposure: totalExposure.toString(),
    authorityLevel,
    requiredApproverCount,
    matrixName,
    decisions,
    signoffs: signoffData,
    explanation: explanations.join(' '),
  };
}

// ---------------------------------------------------------------------------
// Exported service
// ---------------------------------------------------------------------------

export const policyExplainerService = {
  explainItsmPolicy,
  explainCreditPolicy,
};