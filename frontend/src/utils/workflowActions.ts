export type WorkflowActionType =
  | 'SUBMIT_FOR_APPROVAL'
  | 'APPROVE'
  | 'REJECT'
  | 'START_PROCUREMENT'
  | 'MARK_HARDWARE_ORDERED'
  | 'MARK_HARDWARE_RECEIVED'
  | 'MARK_SOFTWARE_PROVISIONED'
  | 'MARK_FULFILLED'
  | 'ASSIGN';

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
  requestTypeName = ''
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
    // Only hardware/software requests go through manager approval + procurement
    if (status === 'SUBMITTED' && isProcurement) {
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

  return actions;
}
