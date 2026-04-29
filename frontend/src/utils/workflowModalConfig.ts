// frontend/src/utils/workflowModalConfig.ts
// Config-driven workflow modal definitions.
// Add new action types here to automatically get a generic WorkflowActionModal —
// no need to create a dedicated modal component or touch ActionSidebar's switch.

import itWorkflowService from '../services/it-workflow.service';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type FieldInputType = 'text' | 'textarea' | 'date' | 'number' | 'select';

export interface WorkflowModalField {
  /** Machine key used as the form state property name */
  name: string;
  /** Human-readable label */
  label: string;
  /** Input control type */
  type: FieldInputType;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required before submit */
  required?: boolean;
  /** Options for select type */
  options?: { value: string; label: string }[];
  /** Default value */
  defaultValue?: string;
  /** Number of rows (textarea only) */
  rows?: number;
}

export type SubmitColor = 'primary' | 'danger' | 'warning' | 'success';

export interface WorkflowModalConfig {
  /** Modal title */
  title: string;
  /** Subtitle / context line (optional) */
  subtitle?: string;
  /** Icon material-symbols-outlined name */
  icon?: string;
  /** Icon background color class (e.g. "bg-green-100") */
  iconBgClass?: string;
  /** Icon text color class (e.g. "text-green-600") */
  iconTextClass?: string;
  /** Form field definitions */
  fields: WorkflowModalField[];
  /** Submit button label */
  submitLabel: string;
  /** Submit button colour variant */
  submitColor: SubmitColor;
  /** Async handler — receives requestId + keyed form values */
  onSubmit: (requestId: string, values: Record<string, unknown>) => Promise<unknown>;
}

/* ------------------------------------------------------------------ */
/*  Modal key → config map                                             */
/* ------------------------------------------------------------------ */

/** Keys must match the ModalType values used in ActionSidebar's openModal state. */
export const WORKFLOW_MODAL_CONFIG: Record<string, WorkflowModalConfig> = {
  APPROVE: {
    title: 'Approve Request',
    subtitle: 'IT Workflow · Manager Approval',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'comment',
        label: 'Approval Comments',
        type: 'textarea',
        placeholder: 'Add any notes for the requester or procurement team…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Approve',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.managerDecision(requestId, 'APPROVED', (values.comment as string) || undefined),
  },

  REJECT: {
    title: 'Reject Request',
    subtitle: 'IT Workflow · Manager Approval',
    icon: 'cancel',
    iconBgClass: 'bg-red-100',
    iconTextClass: 'text-red-600',
    fields: [
      {
        name: 'reason',
        label: 'Rejection Reason',
        type: 'textarea',
        placeholder: 'Provide a reason for rejection…',
        required: true,
        rows: 3,
      },
    ],
    submitLabel: 'Reject',
    submitColor: 'danger',
    onSubmit: (requestId, values) =>
      itWorkflowService.managerDecision(requestId, 'REJECTED', (values.reason as string) || undefined),
  },

  SUBMIT_FOR_APPROVAL: {
    title: 'Submit for Approval',
    subtitle: 'IT Workflow · Submit Request',
    icon: 'approval',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'comment',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Any context for the approver…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.submitForApproval(requestId, '', (values.comment as string) || undefined),
  },

  PROCUREMENT: {
    title: 'Procurement In Progress',
    subtitle: 'IT Workflow · Log vendor & order details',
    icon: 'shopping_cart',
    iconBgClass: 'bg-amber-100',
    iconTextClass: 'text-amber-600',
    fields: [
      {
        name: 'vendor',
        label: 'Vendor Name',
        type: 'text',
        placeholder: 'e.g. Dell, Logitech, CDW…',
        required: true,
      },
      {
        name: 'estimatedCost',
        label: 'Estimated Cost',
        type: 'number',
        placeholder: '0.00',
        required: true,
      },
      {
        name: 'poNumber',
        label: 'PO Number',
        type: 'text',
        placeholder: 'e.g. PO-2026-04-0042',
        required: false,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Any additional procurement notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Procurement',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.markProcurement(requestId, {
        vendor: (values.vendor as string) || undefined,
        estimatedDelivery: (values.estimatedCost as string) || undefined,
        orderNumber: (values.poNumber as string) || undefined,
      }),
  },

  HARDWARE_ORDERED: {
    title: 'Mark Hardware as Ordered',
    subtitle: 'IT Workflow · Record order details',
    icon: 'local_shipping',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'orderRef',
        label: 'Order Reference',
        type: 'text',
        placeholder: 'e.g. PO-2026-01234',
        required: true,
      },
      {
        name: 'estimatedDelivery',
        label: 'Estimated Delivery',
        type: 'date',
        required: true,
      },
    ],
    submitLabel: 'Confirm Order',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.markHardwareOrdered(requestId, {
        orderNumber: (values.orderRef as string) || undefined,
      }),
  },
};

/** Convenience check — does this modal key have a config entry? */
export const hasWorkflowModalConfig = (modalKey: string): modalKey is keyof typeof WORKFLOW_MODAL_CONFIG =>
  modalKey in WORKFLOW_MODAL_CONFIG;