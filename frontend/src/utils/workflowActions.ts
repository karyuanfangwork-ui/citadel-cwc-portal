export type WorkflowActionType =
  | 'SUBMIT_FOR_APPROVAL'
  | 'APPROVE'
  | 'REJECT'
  | 'START_PROCUREMENT'
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
export function getWorkflowActions(
  status: string,
  userRoles: string[],
  isAssigned: boolean
): WorkflowAction[] {
  const isAdmin = userRoles.includes('ADMIN');
  const isAgent = userRoles.includes('AGENT');
  const canAct = isAdmin || isAgent;

  const actions: WorkflowAction[] = [];

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
    if (status === 'SUBMITTED') {
      actions.push({
        type: 'SUBMIT_FOR_APPROVAL',
        label: 'Submit for Manager Approval',
        description: 'Route this IT request to a manager for sign-off.',
        variant: 'primary',
      });
    }
    if (status === 'MANAGER_APPROVED_IT') {
      actions.push({
        type: 'START_PROCUREMENT',
        label: 'Start Procurement',
        description: 'Manager approved. Log vendor details and begin ordering.',
        variant: 'warning',
      });
    }
    if (status === 'PROCUREMENT_IN_PROGRESS') {
      actions.push({
        type: 'MARK_FULFILLED',
        label: 'Mark as Fulfilled',
        description: 'Confirm the item has been delivered to the requester.',
        variant: 'success',
      });
    }
  }

  if (isAdmin && status === 'PENDING_MANAGER_APPROVAL_IT') {
    actions.push(
      {
        type: 'APPROVE',
        label: 'Approve',
        description: 'Approve this IT request to proceed to procurement.',
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
