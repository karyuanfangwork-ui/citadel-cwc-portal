export type WorkflowActionType =
  | 'SUBMIT_FOR_APPROVAL'
  | 'APPROVE'
  | 'REJECT'
  | 'START_PROCUREMENT'
  | 'MARK_HARDWARE_ORDERED'
  | 'MARK_HARDWARE_RECEIVED'
  | 'MARK_SOFTWARE_PROVISIONED'
  | 'MARK_FULFILLED'
  | 'ASSIGN'
  | 'VP_DECISION'
  | 'RESUBMIT_REQUEST'
  | 'ACKNOWLEDGE_IT'
  | 'CEO_DECISION'
  | 'CTO_DECISION'
  | 'ROUTE_TO_CFO'
  | 'CFO_DECISION'
  | 'PAYMENT_DONE'
  | 'COMPLETE_DELIVERY';

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
// Request types that go through the procurement workflow (hardware/software only)
const PROCUREMENT_REQUEST_TYPES = [
  'Request new hardware',
  'Request Software Installation',
];

function isProcurementRequest(requestTypeName: string): boolean {
  return PROCUREMENT_REQUEST_TYPES.some(t =>
    requestTypeName.toLowerCase().includes(t.toLowerCase())
  );
}

export function getWorkflowActions(
  status: string,
  userRoles: string[],
  isAssigned: boolean,
  isDesignatedApprover = false,
  requestTypeName = '',
  isRequester = false
): WorkflowAction[] {
  const isAdmin = userRoles.includes('ADMIN');
  const isAgent = userRoles.includes('AGENT');
  const canAct = isAdmin || isAgent;
  const isProcurement = isProcurementRequest(requestTypeName);

  const actions: WorkflowAction[] = [];

  // Designated approver (e.g. CEO as IT manager approver) can approve/reject
  if (isDesignatedApprover && status === 'PENDING_MANAGER_APPROVAL_IT') {
    actions.push(
      {
        type: 'APPROVE',
        label: 'Approve',
        description: 'Approve this IT request to proceed.',
        variant: 'success',
      },
      {
        type: 'REJECT',
        label: 'Reject',
        description: 'Reject this IT request and notify the requester.',
        variant: 'danger',
      }
    );
    return actions;
  }

  // CEO/CTO/CFO decision blocks — must be above the canAct guard as these roles are not agents/admins
  if (userRoles.includes('CEO') && status === 'PENDING_CEO_APPROVAL_IT') {
    actions.push({
      type: 'CEO_DECISION',
      label: 'CEO Approval Decision',
      description: 'Review and approve or reject this request as CEO.',
      variant: 'primary',
    });
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

  if (isAdmin) {
    // Only non-procurement requests go through manager approval via SUBMIT_FOR_APPROVAL
    if (status === 'SUBMITTED' && !isProcurement) {
      actions.push({
        type: 'SUBMIT_FOR_APPROVAL',
        label: 'Submit for Manager Approval',
        description: 'Route this IT request to a manager for sign-off.',
        variant: 'primary',
      });
    }
    if (status === 'MANAGER_APPROVED_IT' && isProcurement) {
      actions.push({
        type: 'START_PROCUREMENT',
        label: 'Start Procurement',
        description: 'Manager approved. Log vendor details and begin ordering.',
        variant: 'warning',
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

  if (isAdmin && status === 'PENDING_MANAGER_APPROVAL_IT') {
    actions.push(
      {
        type: 'APPROVE',
        label: 'Approve',
        description: 'Approve this IT request to proceed.',
        variant: 'success',
      },
      {
        type: 'REJECT',
        label: 'Reject',
        description: 'Reject this IT request and notify the requester.',
        variant: 'danger',
      }
    );
  }

  if (isAdmin && status === 'PENDING_VP_APPROVAL_IT') {
    actions.push({
      type: 'VP_DECISION',
      label: 'VP Approval Decision',
      description: 'Review and make a VP-level approval decision on this IT request.',
      variant: 'primary',
    });
  }

  if (isRequester && status === 'MANAGER_REJECTED_IT') {
    actions.push({
      type: 'RESUBMIT_REQUEST',
      label: 'Revise & Resubmit',
      description: 'Revise your request based on feedback and resubmit for approval.',
      variant: 'warning',
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
      description: 'Confirm hardware has been delivered to the requester.',
      variant: 'success',
    });
  }

  return actions;
}
