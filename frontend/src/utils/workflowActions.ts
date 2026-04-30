export type WorkflowActionType =
  | 'SUBMIT_FOR_APPROVAL'
  | 'START_PROCUREMENT'
  | 'MARK_HARDWARE_ORDERED'
  | 'MARK_HARDWARE_RECEIVED'
  | 'MARK_SOFTWARE_PROVISIONED'
  | 'MARK_FULFILLED'
  | 'ASSIGN'
  | 'RESUBMIT_REQUEST'
  | 'ACKNOWLEDGE_IT'
  | 'CEO_DECISION'
  | 'CTO_DECISION'
  | 'ROUTE_TO_CFO'
  | 'CFO_DECISION'
  | 'PAYMENT_DONE'
  | 'COMPLETE_DELIVERY'
  | 'MANAGER_DECISION'
  | 'LOA_APPROVAL'
  | 'ROUTE_TO_CEO_HR'
  | 'MARK_JOB_POSTED'
  | 'UPLOAD_RESUME'
  | 'ROUTE_TO_MANAGER'
  | 'SCHEDULE_INTERVIEW'
  | 'UPDATE_SCREENING'
  | 'UPLOAD_LOA'
  | 'ISSUE_LOA'
  | 'UPLOAD_SIGNED_LOA'
  | 'MARK_LOA_ACCEPTED'
  | 'ADVANCE_ONBOARDING_PHASE'
  | 'COMPLETE_ONBOARDING'
  | 'ADVANCE_OFFBOARDING_PHASE'
  | 'COMPLETE_OFFBOARDING'
  | 'START_IT_REVIEW'
  | 'MARK_IN_PROGRESS'
  | 'RESOLVE_IT'
  // Finance Purchase Requisition workflow actions
  | 'FIN_ACKNOWLEDGE'
  | 'SET_FINALIZED_AMOUNT'
  | 'ROUTE_TO_CEO_FIN'
  | 'CFO_DECISION_FIN'
  | 'GROUP_CEO_DECISION_FIN'
  | 'MARK_PAYMENT_COMPLETE_FIN'
  | 'CLOSE_TICKET_FIN'
  // Inter-Company Chargeback workflow actions
  | 'CHARGEBACK_SUBMIT'
  | 'FROM_ENTITY_APPROVE'
  | 'FROM_ENTITY_REJECT'
  | 'TO_ENTITY_APPROVE'
  | 'TO_ENTITY_REJECT'
  | 'CHARGEBACK_MARK_CONFIRMED'
  | 'CHARGEBACK_COMPLETE'
  // Expense Reimbursement workflow actions
  | 'MANAGER_APPROVE_EXPENSE'
  | 'MANAGER_REJECT_EXPENSE'
  | 'FINANCE_HEAD_APPROVE_EXPENSE'
  | 'FINANCE_HEAD_REJECT_EXPENSE'
  | 'MARK_EXPENSE_PAYMENT_COMPLETE';

export interface WorkflowAction {
  type: WorkflowActionType;
  label: string;
  description: string;
  variant: 'primary' | 'success' | 'danger' | 'warning';
}

/**
 * Returns the list of workflow actions available for a given status + role combo.
 * Returns empty array when no actions are available (section should be hidden).
 */
// Only NEW_HARDWARE goes through the procurement workflow with asset registration.
// SOFTWARE_INSTALLATION skips procurement — goes straight to delivery after payment.
const PROCUREMENT_REQUEST_TYPE_CODES = ['NEW_HARDWARE'];

function isProcurementRequest(requestTypeCode: string, requestTypeName: string): boolean {
  if (requestTypeCode) {
    return PROCUREMENT_REQUEST_TYPE_CODES.includes(requestTypeCode);
  }
  // Fallback for records without a code (legacy)
  return ['new hardware', 'software installation'].some(t =>
    requestTypeName.toLowerCase().includes(t)
  );
}

export function getWorkflowActions(
  status: string,
  userRoles: string[],
  isAssigned: boolean,
  isDesignatedApprover = false,
  requestTypeName = '',
  isRequester = false,
  serviceDeskCode = '',
  requiresApproval = true,
  requestTypeCode = '',
  hasResumes = false,
  screeningCompleted = false,
  hasLOA = false,
  hasSignedLOA = false
): WorkflowAction[] {
  const isAdmin = userRoles.includes('ADMIN');
  const isAgent = userRoles.includes('AGENT');
  const canAct = isAdmin || isAgent;
  const isProcurement = isProcurementRequest(requestTypeCode, requestTypeName);
  const isHR = serviceDeskCode === 'HR';

  const actions: WorkflowAction[] = [];

  // Designated approver (e.g. CEO as IT manager approver) — removed (Scenario 3 dead code)
  // CEO/CTO/CFO decision blocks — must be above the canAct guard as these roles are not agents/admins
  if (userRoles.includes('CEO')) {
    if (status === 'PENDING_CEO_APPROVAL_IT' || status === 'PENDING_CEO_APPROVAL') {
      actions.push({
        type: 'CEO_DECISION',
        label: 'CEO Approval Decision',
        description: 'Review and approve or reject this request as CEO.',
        variant: 'primary',
      });
    }
  }

  if (userRoles.includes('CTO') && status === 'PENDING_CTO_APPROVAL_IT') {
    actions.push({
      type: 'CTO_DECISION',
      label: 'CTO Approval Decision',
      description: 'Review and approve or reject this request as CTO.',
      variant: 'primary',
    });
  }

  if (userRoles.includes('CFO') && status === 'PENDING_CFO_APPROVAL_IT') {
    actions.push({
      type: 'CFO_DECISION',
      label: 'CFO Approval Decision',
      description: 'Review and approve or reject this request as CFO.',
      variant: 'primary',
    });
  }

  // Finance Purchase Requisition — Executive approver actions (not gated by canAct)
  const isPurchaseRequisition = requestTypeCode === 'PURCHASE_REQUISITION' ||
    (!requestTypeCode && requestTypeName.toLowerCase().includes('purchase requisition'));

  if (isPurchaseRequisition) {
    if (userRoles.includes('CFO') && status === 'PENDING_CFO_APPROVAL_FIN') {
      actions.push({
        type: 'CFO_DECISION_FIN',
        label: 'CFO Approval Decision',
        description: 'Review and approve or reject this Purchase Requisition as CFO.',
        variant: 'primary',
      });
    }

    if (userRoles.includes('GROUP_CEO') && status === 'PENDING_GROUP_CEO_APPROVAL') {
      actions.push({
        type: 'GROUP_CEO_DECISION_FIN',
        label: 'Group CEO Approval Decision',
        description: 'Review and approve or reject this high-value Purchase Requisition as Group CEO.',
        variant: 'primary',
      });
    }

    // Finance Agent / Admin actions
    if (canAct) {
      if (status === 'FINANCE_PENDING_ACK' || (isPurchaseRequisition && status === 'SUBMITTED')) {
        actions.push({
          type: 'FIN_ACKNOWLEDGE',
          label: 'Acknowledge Request',
          description: 'Acknowledge this Purchase Requisition and begin your review.',
          variant: 'primary',
        });
      }
      if (status === 'FINANCE_ACKNOWLEDGED') {
        actions.push({
          type: 'ROUTE_TO_CEO_FIN',
          label: 'Set Amount & Route to CFO',
          description: 'Enter the finalized amount and route this request to the CFO for approval.',
          variant: 'warning',
        });
      }
      if (status === 'PAYMENT_PROCESSING_FIN') {
        actions.push({
          type: 'MARK_PAYMENT_COMPLETE_FIN',
          label: 'Mark Payment Complete',
          description: 'Enter payment reference and mark the payment as completed.',
          variant: 'success',
        });
      }
      if (status === 'AWAITING_PAYMENT_CONFIRMATION') {
        actions.push({
          type: 'CLOSE_TICKET_FIN',
          label: 'Close Ticket',
          description: 'Payment confirmed. Close this ticket to complete the Purchase Requisition.',
          variant: 'success',
        });
      }
    }
  }

  // Inter-Company Chargeback workflow
  const isChargeback = requestTypeCode === 'INTERCOMPANY_CHARGEBACK' ||
    (!requestTypeCode && requestTypeName.toLowerCase().includes('inter-company chargeback'));
  // Finance actions — only finance desk agents/admins, not entity approvers or other staff
  const isFinanceAgent = canAct && serviceDeskCode === 'FINANCE';

  if (isChargeback) {
    // Finance agent submits chargeback (SUBMITTED → PENDING_FROM_ENTITY_APPROVAL)
    if (isFinanceAgent && status === 'SUBMITTED') {
      actions.push({
        type: 'CHARGEBACK_SUBMIT',
        label: 'Submit for Entity Approval',
        description: 'Submit this chargeback request to the From Entity approver.',
        variant: 'primary',
      });
    }
    // From Entity approver decision — only the designated approver can act
    if (isDesignatedApprover && status === 'PENDING_FROM_ENTITY_APPROVAL') {
      actions.push(
        {
          type: 'FROM_ENTITY_APPROVE',
          label: 'Approve (From Entity)',
          description: 'Approve this chargeback as the From Entity approver.',
          variant: 'success',
        },
        {
          type: 'FROM_ENTITY_REJECT',
          label: 'Reject (From Entity)',
          description: 'Reject this chargeback as the From Entity approver.',
          variant: 'danger',
        }
      );
    }
    // To Entity approver decision — only the designated approver can act
    if (isDesignatedApprover && status === 'PENDING_TO_ENTITY_APPROVAL') {
      actions.push(
        {
          type: 'TO_ENTITY_APPROVE',
          label: 'Approve (To Entity)',
          description: 'Approve this chargeback as the To Entity approver.',
          variant: 'success',
        },
        {
          type: 'TO_ENTITY_REJECT',
          label: 'Reject (To Entity)',
          description: 'Reject this chargeback as the To Entity approver.',
          variant: 'danger',
        }
      );
    }
    // Finance team actions — only finance agents/admins, not entity approvers or other staff
    if (isFinanceAgent && status === 'CHARGEBACK_FINANCE_REVIEW') {
      actions.push({
        type: 'CHARGEBACK_MARK_CONFIRMED',
        label: 'Mark as Confirmed',
        description: 'Confirm the chargeback has been processed and await final confirmation.',
        variant: 'warning',
      });
    }
    if (isFinanceAgent && status === 'AWAITING_CHARGEBACK_CONFIRMATION') {
      actions.push({
        type: 'CHARGEBACK_COMPLETE',
        label: 'Complete Chargeback',
        description: 'Payment confirmed. Close this chargeback ticket.',
        variant: 'success',
      });
    }
  }

  // ─── Expense Reimbursement Workflow ───
  const isExpenseReimbursement = requestTypeCode === 'EXPENSE_CLAIM' ||
    (!requestTypeCode && requestTypeName.toLowerCase().includes('expense claim'));

  if (isExpenseReimbursement) {
    // Finance agent: route submitted expense to manager
    if (canAct && status === 'SUBMITTED') {
      actions.push({
        type: 'SUBMIT_FOR_APPROVAL',
        label: 'Route to Manager Approval',
        description: 'Route this expense claim to the requester\'s manager for approval.',
        variant: 'primary',
      });
    }
    // Manager approval — the requester's manager (isRequester gate doesn't apply here;
    // manager is the designated approver or admin/agent can act on behalf)
    if ((isDesignatedApprover || canAct) && status === 'PENDING_MANAGER_APPROVAL_FIN') {
      actions.push(
        {
          type: 'MANAGER_APPROVE_EXPENSE',
          label: 'Approve Expense Claim',
          description: 'Approve this expense claim and forward to Finance Head.',
          variant: 'success',
        },
        {
          type: 'MANAGER_REJECT_EXPENSE',
          label: 'Reject Expense Claim',
          description: 'Reject this expense claim and return to the requester.',
          variant: 'danger',
        }
      );
    }
    // Finance Head approval
    if (canAct && status === 'PENDING_FINANCE_HEAD_APPROVAL') {
      actions.push(
        {
          type: 'FINANCE_HEAD_APPROVE_EXPENSE',
          label: 'Approve (Finance Head)',
          description: 'Approve this expense claim as Finance Head and route to payment.',
          variant: 'success',
        },
        {
          type: 'FINANCE_HEAD_REJECT_EXPENSE',
          label: 'Reject (Finance Head)',
          description: 'Reject this expense claim as Finance Head.',
          variant: 'danger',
        }
      );
    }
    // Payment processing
    if (canAct && status === 'PAYMENT_PROCESSING') {
      actions.push({
        type: 'MARK_EXPENSE_PAYMENT_COMPLETE',
        label: 'Mark Payment Complete',
        description: 'Enter payment reference and mark the reimbursement as paid.',
        variant: 'success',
      });
    }
    // Requester can revise after manager/finance head rejection
    if (isRequester && (status === 'MANAGER_REJECTED_FIN' || status === 'FINANCE_HEAD_REJECTED')) {
      actions.push({
        type: 'RESUBMIT_REQUEST',
        label: 'Revise & Resubmit',
        description: 'Revise your expense claim based on feedback and resubmit.',
        variant: 'warning',
      });
    }
  }

  // Hiring manager actions — must be above the canAct guard as hiring managers are not agents/admins
  if (isRequester && status === 'PENDING_MANAGER_REVIEW') {
    actions.push({
      type: 'MANAGER_DECISION',
      label: 'Review & Select Candidate',
      description: 'Review the submitted candidate resumes and select one to proceed.',
      variant: 'warning',
    });
  }

  // LOA approval — only the hiring manager (i.e. the requester) for this specific request,
  // and only when the HR agent has uploaded the LOA and routed it for approval
  if (isRequester && status === 'LOA_PENDING_APPROVAL' && hasLOA) {
    actions.push({
      type: 'LOA_APPROVAL',
      label: 'Approve / Reject LOA',
      description: 'Review the Letter of Acceptance and make an approval decision.',
      variant: 'primary',
    });
  }

  if (!canAct) return actions;

  // Unassigned — surface assign action for all agent/admin statuses
  if (!isAssigned) {
    actions.push({
      type: 'ASSIGN',
      label: 'Assign Request',
      description: 'Assign this request to an agent before proceeding.',
      variant: 'primary',
    });
  }

  if (canAct) {
    // Only non-procurement IT requests basic lifecycle — no manager approval (Scenario 3 removed)
    // HR hiring requests go to CEO approval instead — skip this action for HR
    if (status === 'SUBMITTED' && !isProcurement && !isHR && !requiresApproval && serviceDeskCode === 'IT') {
      actions.push({
        type: 'START_IT_REVIEW',
        label: 'Start Review',
        description: 'Begin reviewing this request and move it to In Review.',
        variant: 'primary',
      });
    }

  }

  if (canAct && status === 'PROCUREMENT_IN_PROGRESS' && isProcurement) {
    actions.push({
      type: 'MARK_HARDWARE_ORDERED',
      label: 'Mark Hardware Ordered',
      description: 'Confirm the hardware order has been placed with the vendor.',
      variant: 'warning',
    });
  }
  if (canAct && status === 'HARDWARE_ORDERED' && isProcurement) {
    actions.push({
      type: 'MARK_HARDWARE_RECEIVED',
      label: 'Mark Hardware Received',
      description: 'Confirm the hardware has been received from the vendor.',
      variant: 'warning',
    });
  }
  if (canAct && status === 'HARDWARE_RECEIVED' && isProcurement) {
    actions.push({
      type: 'MARK_SOFTWARE_PROVISIONED',
      label: 'Mark Software Provisioned',
      description: 'Confirm that required software has been installed and configured.',
      variant: 'warning',
    });
  }
  if (canAct && status === 'SOFTWARE_PROVISIONED' && isProcurement) {
    actions.push({
      type: 'MARK_FULFILLED',
      label: 'Close & Resolve',
      description: 'Confirm the item has been delivered to the requester and close the request.',
      variant: 'success',
    });
  }

  // IT Hardware Executive Approval Chain
  if (canAct && status === 'SUBMITTED' && isProcurement) {
    actions.push({
      type: 'ACKNOWLEDGE_IT',
      label: 'Acknowledge & Route to CEO',
      description: 'Acknowledge this request and route it to the CEO for approval.',
      variant: 'primary',
    });
  }

  // HR New Hiring — Route to CEO
  const isNewHiring = requestTypeCode === 'NEW_HIRING' ||
    (!requestTypeCode && requestTypeName.toLowerCase().includes('hiring'));
  if (canAct && isHR && isNewHiring && status === 'JOB_POSTED') {
    if (hasResumes) {
      actions.push({
        type: 'ROUTE_TO_MANAGER',
        label: 'Route to Hiring Manager',
        description: 'Send uploaded resumes to the hiring manager for review.',
        variant: 'warning',
      });
    }
    actions.push({
      type: 'UPLOAD_RESUME',
      label: hasResumes ? 'Upload Another Resume' : 'Upload Candidate Resume',
      description: 'Upload a candidate resume to proceed to hiring manager review.',
      variant: 'success',
    });
  }

  if (canAct && isHR && isNewHiring && status === 'HR_SCREENING') {
    actions.push({
      type: 'UPDATE_SCREENING',
      label: 'Update Screening Status',
      description: 'Update background check and references check status.',
      variant: 'primary',
    });
    if (!hasLOA) {
      actions.push({
        type: 'UPLOAD_LOA',
        label: 'Upload LOA Document',
        description: screeningCompleted
          ? 'Screening complete. Upload the draft Letter of Acceptance.'
          : 'Upload the draft Letter of Acceptance for the candidate.',
        variant: 'success',
      });
    }
  }

  if (canAct && isHR && isNewHiring && status === 'LOA_ACCEPTED' && hasSignedLOA) {
    actions.push({
      type: 'MARK_LOA_ACCEPTED',
      label: 'Mark LOA Accepted',
      description: 'Signed LOA received from candidate. Mark the hiring as complete.',
      variant: 'success',
    });
  }

  if (canAct && isHR && isNewHiring && status === 'LOA_ISSUED' && !hasSignedLOA) {
    actions.push({
      type: 'UPLOAD_SIGNED_LOA',
      label: 'Upload Signed LOA',
      description: 'LOA has been issued. Upload the signed copy received from the candidate.',
      variant: 'primary',
    });
  }

  if (canAct && isHR && isNewHiring && status === 'LOA_APPROVED') {
    actions.push({
      type: 'ISSUE_LOA',
      label: 'Issue LOA to Candidate',
      description: 'LOA has been approved. Issue it to the candidate.',
      variant: 'primary',
    });
  }

  if (canAct && isHR && isNewHiring && status === 'LOA_PENDING_APPROVAL' && screeningCompleted && !hasLOA) {
    actions.push({
      type: 'UPLOAD_LOA',
      label: 'Upload LOA Document',
      description: 'Upload the draft Letter of Acceptance for the candidate.',
      variant: 'success',
    });
  }

  if (canAct && isHR && isNewHiring && status === 'MANAGER_APPROVED') {
    actions.push({
      type: 'SCHEDULE_INTERVIEW',
      label: 'Schedule Interview',
      description: 'Hiring manager selected a candidate. Schedule the interview.',
      variant: 'primary',
    });
  }

  if (canAct && isHR && isNewHiring && status === 'CEO_APPROVED') {
    actions.push({
      type: 'MARK_JOB_POSTED',
      label: 'Mark Job as Posted',
      description: 'CEO has approved. Record the job posting URL to proceed.',
      variant: 'primary',
    });
  }

  if (canAct && isHR && isNewHiring && (status === 'SUBMITTED' || status === 'IN_REVIEW')) {
    actions.push({
      type: 'ROUTE_TO_CEO_HR',
      label: 'Route to CEO for Approval',
      description: 'Route this hiring request to the CEO for sign-off.',
      variant: 'primary',
    });
  }

  if (canAct && serviceDeskCode === 'IT' && !isProcurement && status === 'IN_REVIEW') {
    actions.push({
      type: 'MARK_IN_PROGRESS',
      label: 'Mark In Progress',
      description: 'Start actively working on this request.',
      variant: 'primary',
    });
  }

  if (canAct && serviceDeskCode === 'IT' && !isProcurement && status === 'IN_PROGRESS') {
    actions.push({
      type: 'RESOLVE_IT',
      label: 'Resolve Ticket',
      description: 'Mark this request as resolved and close it.',
      variant: 'success',
    });
  }

  if (canAct && status === 'PENDING_INVOICE_IT') {
    actions.push({
      type: 'ROUTE_TO_CFO',
      label: 'Route to CFO for Approval',
      description: 'Select CFO and route this request for CFO approval.',
      variant: 'warning',
    });
  }

  if (canAct && status === 'PAYMENT_PROCESSING_IT') {
    actions.push({
      type: 'PAYMENT_DONE',
      label: 'Mark Payment Done',
      description: 'Enter payment details and mark payment as completed.',
      variant: 'success',
    });
  }

  if (canAct && status === 'PENDING_DELIVERY_IT') {
    actions.push({
      type: 'COMPLETE_DELIVERY',
      label: 'Complete Delivery',
      description: 'Confirm software has been delivered/installed for the requester.',
      variant: 'success',
    });
  }

  // Offboarding ticket phase advancement
  const isOffboardingTicket = requestTypeCode === 'EMPLOYEE_OFFBOARDING' ||
    (!requestTypeCode && requestTypeName.toLowerCase().includes('offboard'));
  if (canAct && isHR && isOffboardingTicket) {
    const offboardingPhaseActions: Record<string, { label: string; description: string }> = {
      SUBMITTED: {
        label: 'Start Notice Period',
        description: 'Begin the offboarding process and initiate the notice period tasks.',
      },
      OFFBOARDING_SUBMITTED: {
        label: 'Start Notice Period',
        description: 'Begin the offboarding process and initiate the notice period tasks.',
      },
      OFFBOARDING_NOTICE_PERIOD: {
        label: 'Begin Knowledge Transfer',
        description: 'Notice period underway. Advance to the knowledge transfer phase.',
      },
      OFFBOARDING_KNOWLEDGE_TRANSFER: {
        label: 'Advance to Final Week',
        description: 'Knowledge transfer complete. Move to the final week phase.',
      },
      OFFBOARDING_FINAL_WEEK: {
        label: 'Begin Exit Procedures',
        description: 'Final week in progress. Start exit procedures (IT revocation, hardware collection, etc.).',
      },
    };
    const phaseAction = offboardingPhaseActions[status];
    if (phaseAction) {
      actions.push({
        type: 'ADVANCE_OFFBOARDING_PHASE',
        label: phaseAction.label,
        description: phaseAction.description,
        variant: 'primary',
      });
    }
    if (status === 'OFFBOARDING_EXIT_PROCEDURES') {
      actions.push({
        type: 'COMPLETE_OFFBOARDING',
        label: 'Complete Offboarding',
        description: 'All tasks done. Mark this offboarding as complete and close the ticket.',
        variant: 'success',
      });
    }
  }

  // Onboarding ticket phase advancement
  const isOnboardingTicket = requestTypeCode === 'EMPLOYEE_ONBOARDING' ||
    (!requestTypeCode && requestTypeName.toLowerCase().includes('onboard'));
  if (canAct && isHR && isOnboardingTicket) {
    const onboardingPhaseActions: Record<string, { label: string; description: string }> = {
      SUBMITTED: {
        label: 'Start Pre-Arrival Setup',
        description: 'Review the new hire details and begin pre-arrival tasks such as account creation and equipment provisioning.',
      },
      ONBOARDING_SUBMITTED: {
        label: 'Start Pre-Arrival Setup',
        description: 'Review the new hire details and begin pre-arrival tasks such as account creation and equipment provisioning.',
      },
      ONBOARDING_PRE_ARRIVAL_SETUP: {
        label: 'Mark Day 1 Ready',
        description: 'Complete all pre-arrival tasks in the checklist below, then advance to Day 1 Ready.',
      },
      ONBOARDING_READY_FOR_DAY_1: {
        label: 'Begin Day 1 Orientation',
        description: 'New hire is arriving today. Start the Day 1 orientation phase.',
      },
      ONBOARDING_DAY_1_ORIENTATION: {
        label: 'Advance to Week 1 Integration',
        description: 'Day 1 complete. Move the new hire into the Week 1 integration phase.',
      },
    };
    const phaseAction = onboardingPhaseActions[status];
    if (phaseAction) {
      actions.push({
        type: 'ADVANCE_ONBOARDING_PHASE',
        label: phaseAction.label,
        description: phaseAction.description,
        variant: 'primary',
      });
    }
    if (status === 'ONBOARDING_WEEK_1_INTEGRATION') {
      actions.push({
        type: 'COMPLETE_ONBOARDING',
        label: 'Complete Onboarding',
        description: 'All tasks are done. Mark this onboarding as complete and close the ticket.',
        variant: 'success',
      });
    }
  }

  return actions;
}
