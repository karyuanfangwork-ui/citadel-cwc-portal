// frontend/src/utils/workflowModalConfig.ts
// Config-driven workflow modal definitions.
// Add new action types here to automatically get a generic WorkflowActionModal —
// no need to create a dedicated modal component.

import itWorkflowService from '../services/it-workflow.service';
import financeWorkflowService from '../services/finance-workflow.service';
import chargebackWorkflowService from '../services/chargeback-workflow.service';
import { requestService } from '../services/request.service';
import api from '../services/api';
import approvalService from '../services/approval.service';
import interviewService from '../services/interview.service';
import screeningService from '../services/screening.service';
import loaService from '../services/loa.service';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type FieldInputType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'select'
  | 'time-select'
  | 'file'
  | 'approver-picker';

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
  /** Options for select type (static) */
  options?: { value: string; label: string }[];
  /** Async options loader — called on mount to populate select options dynamically */
  asyncOptions?: () => Promise<{ value: string; label: string }[]>;
  /** Default value */
  defaultValue?: string;
  /** Number of rows (textarea only) */
  rows?: number;
  /** Executive role to fetch (only used when type === 'approver-picker') */
  approverRole?: 'GROUP_DCEO' | 'CEO' | 'CTO' | 'CFO' | 'CMO' | 'COO' | 'CHRO';
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
  /**Conditionally show/hide the modal based on request & user context */
  showWhen?: (request: any, user: any) => boolean;
  /** Custom validation returning field→error map (empty = valid) */
  validation?: (values: Record<string, unknown>) => Record<string, string>;
  /** Required permission to display this modal */
  requiresPermission?: string;
  /** Label shown while the submit is in-flight */
  loadingLabel?: string;
}

/* ------------------------------------------------------------------ */
/*  Reusable field presets                                              */
/* ------------------------------------------------------------------ */

const DECISION_OPTIONS: { value: string; label: string }[] = [
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
];

const SCREENING_RESULT_OPTIONS: { value: string; label: string }[] = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
];

const INTERVIEW_RECOMMENDATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'STRONG_YES', label: 'Strong Yes' },
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'STRONG_NO', label: 'Strong No' },
];

/* ------------------------------------------------------------------ */
/*  Modal key → config map                                             */
/* ------------------------------------------------------------------ */

/** Keys must match the ModalType values used in the workflow action state. */
export const WORKFLOW_MODAL_CONFIG: Record<string, WorkflowModalConfig> = {
  /* ────────────────────────────────────────────────────────────────── *
   *  IT WORKFLOW                                                      *
   * ────────────────────────────────────────────────────────────────── */

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

  HARDWARE_RECEIVED: {
    title: 'Mark Hardware as Received',
    subtitle: 'IT Workflow · Confirm hardware delivery',
    icon: 'inventory_2',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Receiving notes, condition, etc.',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Received',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      itWorkflowService.markHardwareReceived(requestId, {
        notes: (values.notes as string) || undefined,
      }),
  },

  SOFTWARE_PROVISIONED: {
    title: 'Mark Software as Provisioned',
    subtitle: 'IT Workflow · Confirm software setup',
    icon: 'cloud_done',
    iconBgClass: 'bg-purple-100',
    iconTextClass: 'text-purple-600',
    fields: [
      {
        name: 'notes',
        label: 'Provisioning Notes',
        type: 'textarea',
        placeholder: 'Describe software provisioned, licenses assigned…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Provisioned',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      itWorkflowService.markSoftwareProvisioned(requestId, {
        provisioningNotes: (values.notes as string) || undefined,
      }),
  },

  FULFILMENT: {
    title: 'Mark as Fulfilled',
    subtitle: 'IT Workflow · Confirm request fulfilment',
    icon: 'task_alt',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Fulfilment details…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Fulfilment',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      itWorkflowService.markFulfilled(requestId, (values.notes as string) || undefined),
  },

  ASSIGN: {
    title: 'Assign Request',
    subtitle: 'Assign this request to an agent',
    icon: 'person_add',
    iconBgClass: 'bg-indigo-100',
    iconTextClass: 'text-indigo-600',
    fields: [],
    submitLabel: 'Assign',
    submitColor: 'primary',
    onSubmit: (requestId) =>
      requestService.updateStatus(requestId, 'ASSIGNED' as any),
  },

  ACKNOWLEDGE_IT: {
    title: 'Acknowledge & Route to CEO',
    subtitle: 'IT Workflow · Pick the CEO or accept the auto-selected default',
    icon: 'task_alt',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'ceoId',
        label: 'Route CEO',
        type: 'approver-picker',
        approverRole: 'CEO',
        required: false,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional acknowledgement notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Acknowledge & Route',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.acknowledgeRequest(
        requestId,
        (values.notes as string) || undefined,
        (values.ceoId as string) || undefined,
      ),
  },

  CEO_DECISION_IT: {
    title: 'CEO Decision',
    subtitle: 'IT Workflow · Approve or reject (on approve, route to CTO)',
    icon: 'gavel',
    iconBgClass: 'bg-amber-100',
    iconTextClass: 'text-amber-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'ctoId',
        label: 'Route CTO (on Approve)',
        type: 'approver-picker',
        approverRole: 'CTO',
        required: false,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.ceoDecision(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        (values.notes as string) || undefined,
        (values.ctoId as string) || undefined,
      ),
  },

  CEO_DECISION_HR: {
    title: 'CEO Decision',
    subtitle: 'HR Workflow · Approve or reject',
    icon: 'gavel',
    iconBgClass: 'bg-amber-100',
    iconTextClass: 'text-amber-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      approvalService.ceoDecision(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        (values.notes as string) || undefined,
      ),
  },

  CTO_DECISION: {
    title: 'CTO Decision',
    subtitle: 'IT Workflow · Approve or reject',
    icon: 'gavel',
    iconBgClass: 'bg-teal-100',
    iconTextClass: 'text-teal-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.ctoDecision(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        (values.notes as string) || undefined,
      ),
  },

  ROUTE_TO_CFO: {
    title: 'Route to CFO',
    subtitle: 'IT Workflow · Forward for CFO approval',
    icon: 'send',
    iconBgClass: 'bg-orange-100',
    iconTextClass: 'text-orange-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes for CFO…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Route to CFO',
    submitColor: 'primary',
    loadingLabel: 'Routing…',
    onSubmit: (requestId, values) =>
      api.post(`/it-workflow/requests/${requestId}/route-to-cfo`, {
        notes: (values.notes as string) || undefined,
      }),
  },

  CFO_DECISION: {
    title: 'CFO Decision',
    subtitle: 'IT Workflow · Approve or reject payment',
    icon: 'gavel',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      itWorkflowService.cfoDecision(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        (values.notes as string) || undefined,
      ),
  },

  PAYMENT_DONE: {
    title: 'Mark Payment Done',
    subtitle: 'IT Workflow · Record payment reference',
    icon: 'payments',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'paymentRef',
        label: 'Payment Reference',
        type: 'text',
        placeholder: 'e.g. PAY-2026-00123',
        required: true,
      },
      {
        name: 'amount',
        label: 'Amount',
        type: 'number',
        placeholder: '0.00',
        required: true,
      },
      {
        name: 'paymentDate',
        label: 'Payment Date',
        type: 'date',
        required: true,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional payment notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Payment',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      itWorkflowService.markPaymentDone(requestId, {
        paymentReference: (values.paymentRef as string) || '',
        amount: Number(values.amount) || 0,
        paymentDate: (values.paymentDate as string) || '',
        notes: (values.notes as string) || undefined,
      }),
  },

  COMPLETE_DELIVERY: {
    title: 'Complete Delivery',
    subtitle: 'IT Workflow · Confirm delivery complete',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional delivery confirmation notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Delivery',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      itWorkflowService.completeDelivery(requestId, (values.notes as string) || undefined),
  },

  /* ────────────────────────────────────────────────────────────────── *
   *  FINANCE WORKFLOW                                                  *
   * ────────────────────────────────────────────────────────────────── */

  FIN_ACKNOWLEDGE: {
    title: 'Acknowledge Finance Request',
    subtitle: 'Finance Workflow · Confirm acknowledgement',
    icon: 'task_alt',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional acknowledgement notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Acknowledge',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      financeWorkflowService.acknowledge(requestId, (values.notes as string) || undefined),
  },

  ROUTE_TO_CFO_FIN: {
    title: 'Route to CFO',
    subtitle: 'Finance Workflow · Set finalized amount, attach invoice & forward',
    icon: 'send',
    iconBgClass: 'bg-orange-100',
    iconTextClass: 'text-orange-600',
    fields: [
      {
        name: 'finalizedAmount',
        label: 'Finalized Amount',
        type: 'number',
        placeholder: '0.00',
        required: true,
      },
      {
        name: 'invoice',
        label: 'Invoice',
        type: 'file',
        placeholder: '.pdf,.doc,.docx,.png,.jpg,.jpeg',
        required: true,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes for CFO…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Route to CFO',
    submitColor: 'primary',
    loadingLabel: 'Routing…',
    onSubmit: (requestId, values) =>
      financeWorkflowService.setFinalizedAmountAndRouteCfo(
        requestId,
        Number(values.finalizedAmount) || 0,
        (values.notes as string) || undefined,
        (values.invoice ? [values.invoice as File] : undefined),
      ),
  },

  ROUTE_TO_CFO_BP: {
    title: 'Route to CFO',
    subtitle: 'Budget Proposal · Forward for CFO approval',
    icon: 'send',
    iconBgClass: 'bg-amber-100',
    iconTextClass: 'text-amber-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes for CFO…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Route to CFO',
    submitColor: 'primary',
    loadingLabel: 'Routing…',
    onSubmit: (requestId, values) =>
      financeWorkflowService.routeToCfo(
        requestId,
        (values.notes as string) || undefined,
      ),
  },

  CFO_DECISION_FIN: {
    title: 'CFO Decision',
    subtitle: 'Finance Workflow · Approve or reject',
    icon: 'gavel',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      financeWorkflowService.cfoDecision(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        (values.notes as string) || undefined,
      ),
  },


  GROUP_DCEO_DECISION_FIN: {
    title: 'Group Deputy CEO Decision',
    subtitle: 'Finance Workflow · Approve or reject high-value Purchase Requisition',
    icon: 'gavel',
    iconBgClass: 'bg-red-100',
    iconTextClass: 'text-red-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      financeWorkflowService.groupDceoDecision(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        (values.notes as string) || undefined,
      ),
  },

  MARK_PAYMENT_COMPLETE_FIN: {
    title: 'Mark Payment Complete',
    subtitle: 'Finance Workflow · Record payment reference',
    icon: 'payments',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'paymentRef',
        label: 'Payment Reference',
        type: 'text',
        placeholder: 'e.g. PAY-2026-00456',
        required: false,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional payment notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Payment',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      financeWorkflowService.markPaymentComplete(
        requestId,
        (values.paymentRef as string) || undefined,
        (values.notes as string) || undefined,
      ),
  },

  CLOSE_TICKET_FIN: {
    title: 'Close Finance Ticket',
    subtitle: 'Finance Workflow · Finalize and close',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Closing Notes',
        type: 'textarea',
        placeholder: 'Optional closing remarks…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Close Ticket',
    submitColor: 'success',
    onSubmit: (requestId) =>
      financeWorkflowService.closeTicket(requestId),
  },

  CLOSE_BUDGET_PROPOSAL: {
    title: 'Update & Close Budget Proposal',
    subtitle: 'Finance Workflow · Update budget record and close',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Closing Notes',
        type: 'textarea',
        placeholder: 'Budget adoption confirmed. Add any closing notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Update & Close',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      financeWorkflowService.updateAndCloseBudget(requestId, (values.notes as string) || undefined),
  },

  /* ────────────────────────────────────────────────────────────────── *
   *  HR WORKFLOW                                                       *
   * ────────────────────────────────────────────────────────────────── */

  ROUTE_TO_CEO_HR: {
    title: 'Route to CEO',
    subtitle: 'HR Workflow · Select CEO and forward for approval',
    icon: 'send',
    iconBgClass: 'bg-orange-100',
    iconTextClass: 'text-orange-600',
    fields: [
      {
        name: 'ceoId',
        label: 'Select CEO',
        type: 'select',
        required: true,
        placeholder: 'Choose a CEO…',
        asyncOptions: async () => {
          const users = await itWorkflowService.getUsersByRole('CEO');
          return users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }));
        },
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes for CEO…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Route to CEO',
    submitColor: 'primary',
    loadingLabel: 'Routing…',
    onSubmit: (requestId, values) =>
      approvalService.routeToCEO(requestId, (values.ceoId as string) || undefined, (values.notes as string) || undefined),
  },

  ROUTE_TO_GROUP_DCEO_HR: {
    title: 'Route to Group Deputy CEO',
    subtitle: 'HR Workflow · Select Group Deputy CEO and forward for approval',
    icon: 'send',
    iconBgClass: 'bg-orange-100',
    iconTextClass: 'text-orange-600',
    fields: [
      {
        name: 'groupDceoId',
        label: 'Select Group Deputy CEO',
        type: 'select',
        required: true,
        placeholder: 'Choose a Group Deputy CEO…',
        asyncOptions: async () => {
          const users = await itWorkflowService.getUsersByRole('GROUP_DCEO');
          return users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }));
        },
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes for Group Deputy CEO…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Route to Group Deputy CEO',
    submitColor: 'primary',
    loadingLabel: 'Routing…',
    onSubmit: (requestId, values) =>
      approvalService.routeToGroupDceoHR(requestId, (values.notes as string) || undefined, (values.groupDceoId as string) || undefined),
  },

  GROUP_DCEO_DECISION_HR: {
    title: 'Group Deputy CEO Decision (HR)',
    subtitle: 'HR Workflow · Approve or reject',
    icon: 'gavel',
    iconBgClass: 'bg-purple-100',
    iconTextClass: 'text-purple-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      approvalService.groupDceoDecisionHR(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        (values.notes as string) || undefined
      ),
  },

  MARK_JOB_POSTED: {
    title: 'Mark Job as Posted',
    subtitle: 'HR Workflow · Record job posting details',
    icon: 'work',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'jobPostUrl',
        label: 'Job Post URL',
        type: 'text',
        placeholder: 'https://careers.example.com/job/12345',
        required: false,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Job posting details…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Mark as Posted',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      approvalService.markJobPosted(
        requestId,
        (values.jobPostUrl as string) || undefined,
        (values.notes as string) || undefined
      ),
  },

  UPLOAD_RESUME: {
    title: 'Upload Resume',
    subtitle: 'HR Workflow · Attach candidate resume',
    icon: 'upload_file',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Candidate details or notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Upload Resume',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      api.post(`/approvals/requests/${requestId}/upload-resume`, {
        notes: (values.notes as string) || undefined,
      }),
  },

  MANAGER_DECISION: {
    title: 'Manager Decision (HR)',
    subtitle: 'HR Workflow · Approve or reject candidate',
    icon: 'gavel',
    iconBgClass: 'bg-amber-100',
    iconTextClass: 'text-amber-600',
    fields: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: DECISION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Comments',
        type: 'textarea',
        placeholder: 'Reason for decision…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Submit Decision',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      approvalService.managerDecision(
        requestId,
        (values.decision as string) === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        [],
        (values.notes as string) || undefined
      ),
  },

  SCHEDULE_INTERVIEW: {
    title: 'Schedule Interview',
    subtitle: 'HR Workflow · Set interview date & time',
    icon: 'calendar_month',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'interviewDate',
        label: 'Interview Date',
        type: 'date',
        required: true,
      },
      {
        name: 'interviewTime',
        label: 'Interview Time',
        type: 'time-select',
        required: true,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Interview details…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Schedule Interview',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      interviewService.scheduleInterview(requestId, {
        candidateId: '', // populated by context
        interviewDate: (values.interviewDate as string) || '',
        interviewTime: (values.interviewTime as string) || '',
        notes: (values.notes as string) || undefined,
        interviewers: [],
      } as any),
  },

  UPDATE_SCREENING: {
    title: 'Update Screening',
    subtitle: 'HR Workflow · Record screening results',
    icon: 'fact_check',
    iconBgClass: 'bg-indigo-100',
    iconTextClass: 'text-indigo-600',
    fields: [
      {
        name: 'screeningNotes',
        label: 'Screening Notes',
        type: 'textarea',
        placeholder: 'Screening observations…',
        required: false,
        rows: 3,
      },
      {
        name: 'screeningResult',
        label: 'Screening Result',
        type: 'select',
        required: true,
        options: SCREENING_RESULT_OPTIONS,
      },
    ],
    submitLabel: 'Update Screening',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      screeningService.updateScreeningStatus(requestId, {
        backgroundCheckStatus: (values.screeningResult as string) === 'PASS' ? 'PASSED' : 'FAILED',
        backgroundCheckNotes: (values.screeningNotes as string) || undefined,
        referencesCheckStatus: (values.screeningResult as string) === 'PASS' ? 'PASSED' : 'FAILED',
        referencesCheckNotes: (values.screeningNotes as string) || undefined,
      }),
  },

  UPLOAD_LOA: {
    title: 'Upload Letter of Acceptance',
    subtitle: 'HR Workflow · Upload LOA document',
    icon: 'upload_file',
    iconBgClass: 'bg-blue-100',
    iconTextClass: 'text-blue-600',
    fields: [
      {
        name: 'loaFile',
        label: 'LOA Document',
        type: 'file',
        placeholder: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
        required: true,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes about the LOA…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Upload LOA',
    submitColor: 'primary',
    onSubmit: async (requestId, values) => {
      const file = values.loaFile as File | null;
      if (!file) throw new Error('LOA file is required');
      return loaService.uploadLOA(requestId, file);
    },
  },

  ROUTE_LOA_FOR_APPROVAL: {
    title: 'Route LOA for Approval',
    subtitle: 'HR Workflow · Send LOA to hiring manager for review',
    icon: 'send',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes for the hiring manager…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Route for Approval',
    submitColor: 'success',
    onSubmit: async (requestId) => {
      return loaService.routeForApproval(requestId);
    },
  },

  UPLOAD_SIGNED_LOA: {
    title: 'Upload Signed LOA',
    subtitle: 'HR Workflow · Upload signed Letter of Acceptance',
    icon: 'upload_file',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'signedLoaFile',
        label: 'Signed LOA Document',
        type: 'file',
        placeholder: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
        required: true,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional notes about the signed LOA…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Upload Signed LOA',
    submitColor: 'primary',
    onSubmit: async (requestId, values) => {
      const file = values.signedLoaFile as File | null;
      if (!file) throw new Error('Signed LOA file is required');
      return loaService.uploadSignedLOA(requestId, file);
    },
  },

  INTERVIEW_FEEDBACK: {
    title: 'Interview Feedback',
    subtitle: 'HR Workflow · Record interview evaluation',
    icon: 'rate_review',
    iconBgClass: 'bg-purple-100',
    iconTextClass: 'text-purple-600',
    fields: [
      {
        name: 'feedback',
        label: 'Feedback',
        type: 'textarea',
        placeholder: 'Detailed interview feedback…',
        required: true,
        rows: 4,
      },
      {
        name: 'recommendation',
        label: 'Recommendation',
        type: 'select',
        required: true,
        options: INTERVIEW_RECOMMENDATION_OPTIONS,
      },
      {
        name: 'notes',
        label: 'Additional Notes',
        type: 'textarea',
        placeholder: 'Any additional notes…',
        required: false,
        rows: 2,
      },
    ],
    submitLabel: 'Submit Feedback',
    submitColor: 'primary',
    onSubmit: (requestId, values) =>
      interviewService.submitFeedback(requestId, {
        decision: (['STRONG_YES', 'YES'] as string[]).includes(values.recommendation as string)
          ? 'PROCEED'
          : 'REJECT',
        overallRating: 3,
        technicalSkills: 3,
        culturalFit: 3,
        communication: 3,
        feedback: (values.feedback as string) || '',
        concerns: (values.notes as string) || undefined,
      } as any),
  },

  /* ────────────────────────────────────────────────────────────────── *
   *  CHARGEBACK / ENTITY WORKFLOW                                      *
   * ────────────────────────────────────────────────────────────────── */

  FROM_ENTITY_APPROVE: {
    title: 'Approve (From Entity)',
    subtitle: 'Chargeback · Approve chargeback from originating entity',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional approval comments…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Approve',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      chargebackWorkflowService.fromEntityDecision(
        requestId,
        'APPROVED',
        (values.notes as string) || undefined,
      ),
  },

  FROM_ENTITY_REJECT: {
    title: 'Reject (From Entity)',
    subtitle: 'Chargeback · Reject chargeback from originating entity',
    icon: 'cancel',
    iconBgClass: 'bg-red-100',
    iconTextClass: 'text-red-600',
    fields: [
      {
        name: 'reason',
        label: 'Reason for Rejection',
        type: 'textarea',
        placeholder: 'Why is this chargeback being rejected?',
        required: true,
        rows: 3,
      },
    ],
    submitLabel: 'Reject',
    submitColor: 'danger',
    onSubmit: (requestId, values) =>
      chargebackWorkflowService.fromEntityDecision(
        requestId,
        'REJECTED',
        (values.reason as string) || undefined,
      ),
  },

  TO_ENTITY_APPROVE: {
    title: 'Approve (To Entity)',
    subtitle: 'Chargeback · Approve chargeback to receiving entity',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional approval comments…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Approve',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      chargebackWorkflowService.toEntityDecision(
        requestId,
        'APPROVED',
        (values.notes as string) || undefined,
      ),
  },

  TO_ENTITY_REJECT: {
    title: 'Reject (To Entity)',
    subtitle: 'Chargeback · Reject chargeback to receiving entity',
    icon: 'cancel',
    iconBgClass: 'bg-red-100',
    iconTextClass: 'text-red-600',
    fields: [
      {
        name: 'reason',
        label: 'Reason for Rejection',
        type: 'textarea',
        placeholder: 'Why is this chargeback being rejected?',
        required: true,
        rows: 3,
      },
    ],
    submitLabel: 'Reject',
    submitColor: 'danger',
    onSubmit: (requestId, values) =>
      chargebackWorkflowService.toEntityDecision(
        requestId,
        'REJECTED',
        (values.reason as string) || undefined,
      ),
  },

  /* ────────────────────────────────────────────────────────────────── *
   *  EXPENSE / REIMBURSEMENT WORKFLOW                                  *
   * ────────────────────────────────────────────────────────────────── */

  MANAGER_APPROVE_EXPENSE: {
    title: 'Approve Expense (Manager)',
    subtitle: 'Expense · Manager approval',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional approval comments…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Approve',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      financeWorkflowService.managerApproveExpense(
        requestId,
        (values.notes as string) || undefined,
      ),
  },

  MANAGER_REJECT_EXPENSE: {
    title: 'Reject Expense (Manager)',
    subtitle: 'Expense · Manager rejection',
    icon: 'cancel',
    iconBgClass: 'bg-red-100',
    iconTextClass: 'text-red-600',
    fields: [
      {
        name: 'reason',
        label: 'Reason for Rejection',
        type: 'textarea',
        placeholder: 'Why is this expense being rejected?',
        required: true,
        rows: 3,
      },
    ],
    submitLabel: 'Reject',
    submitColor: 'danger',
    onSubmit: (requestId, values) =>
      financeWorkflowService.managerRejectExpense(
        requestId,
        (values.reason as string) || undefined,
      ),
  },

  FINANCE_HEAD_APPROVE_EXPENSE: {
    title: 'Approve Expense (Finance Head)',
    subtitle: 'Expense · Finance Head approval',
    icon: 'check_circle',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional approval comments…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Approve',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      financeWorkflowService.financeHeadApproveExpense(
        requestId,
        (values.notes as string) || undefined,
      ),
  },

  FINANCE_HEAD_REJECT_EXPENSE: {
    title: 'Reject Expense (Finance Head)',
    subtitle: 'Expense · Finance Head rejection',
    icon: 'cancel',
    iconBgClass: 'bg-red-100',
    iconTextClass: 'text-red-600',
    fields: [
      {
        name: 'reason',
        label: 'Reason for Rejection',
        type: 'textarea',
        placeholder: 'Why is this expense being rejected?',
        required: true,
        rows: 3,
      },
    ],
    submitLabel: 'Reject',
    submitColor: 'danger',
    onSubmit: (requestId, values) =>
      financeWorkflowService.financeHeadRejectExpense(
        requestId,
        (values.reason as string) || undefined,
      ),
  },

  MARK_EXPENSE_PAYMENT_COMPLETE: {
    title: 'Mark Expense Payment Complete',
    subtitle: 'Expense · Record payment reference',
    icon: 'payments',
    iconBgClass: 'bg-green-100',
    iconTextClass: 'text-green-600',
    fields: [
      {
        name: 'paymentRef',
        label: 'Payment Reference',
        type: 'text',
        placeholder: 'e.g. EXP-PAY-2026-001',
        required: false,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional payment notes…',
        required: false,
        rows: 3,
      },
    ],
    submitLabel: 'Confirm Payment',
    submitColor: 'success',
    onSubmit: (requestId, values) =>
      financeWorkflowService.markExpensePaymentComplete(
        requestId,
        (values.paymentRef as string) || undefined,
        (values.notes as string) || undefined,
      ),
  },
};

/** Convenience check — does this modal key have a config entry? */
export const hasWorkflowModalConfig = (modalKey: string): modalKey is keyof typeof WORKFLOW_MODAL_CONFIG =>
  modalKey in WORKFLOW_MODAL_CONFIG;