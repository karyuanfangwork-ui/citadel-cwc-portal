
import React from 'react';
import { RequestStatus } from './types';

export const STATUS_CONFIG: Record<RequestStatus, { label: string, color: string, bg: string, icon: string }> = {
  [RequestStatus.SUBMITTED]: { label: 'SUBMITTED', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'send' },
  [RequestStatus.IN_REVIEW]: { label: 'IN REVIEW', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: 'manage_search' },
  [RequestStatus.ACTION_REQUIRED]: { label: 'ACTION REQUIRED', color: 'text-orange-700', bg: 'bg-orange-100', icon: 'warning' },
  [RequestStatus.APPROVED]: { label: 'APPROVED', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: 'check_circle' },
  [RequestStatus.REJECTED]: { label: 'REJECTED', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.RESOLVED]: { label: 'COMPLETED', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: 'task_alt' },
  [RequestStatus.IN_PROGRESS]: { label: 'IN PROGRESS', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'sync' },
  [RequestStatus.WAITING]: { label: 'WAITING', color: 'text-gray-600', bg: 'bg-gray-100', icon: 'hourglass_empty' },
  [RequestStatus.PENDING_CEO_APPROVAL]: { label: 'PENDING CEO APPROVAL', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'pending' },
  [RequestStatus.CEO_APPROVED]: { label: 'CEO APPROVED', color: 'text-green-700', bg: 'bg-green-100', icon: 'verified' },
  [RequestStatus.CEO_REJECTED]: { label: 'CEO REJECTED', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.JOB_POSTED]: { label: 'JOB POSTED', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'work' },
  [RequestStatus.PENDING_MANAGER_REVIEW]: { label: 'PENDING MANAGER REVIEW', color: 'text-orange-700', bg: 'bg-orange-100', icon: 'pending' },
  [RequestStatus.MANAGER_APPROVED]: { label: 'MANAGER APPROVED', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.INTERVIEW_SCHEDULED]: { label: 'INTERVIEW SCHEDULED', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: 'event' },
  [RequestStatus.INTERVIEW_FEEDBACK_PENDING]: { label: 'FEEDBACK RECEIVED', color: 'text-orange-700', bg: 'bg-orange-100', icon: 'rate_review' },
  [RequestStatus.CANDIDATE_REJECTED_INTERVIEW]: { label: 'CANDIDATE REJECTED', color: 'text-red-700', bg: 'bg-red-100', icon: 'person_off' },
  [RequestStatus.HR_SCREENING]: { label: 'REFERENCE CHECK', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'person_search' },
  [RequestStatus.LOA_PENDING_APPROVAL]: { label: 'LOA APPROVAL', color: 'text-orange-700', bg: 'bg-orange-100', icon: 'pending' },
  [RequestStatus.LOA_APPROVED]: { label: 'LOA APPROVED', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: 'check_circle' },
  [RequestStatus.LOA_ISSUED]: { label: 'LOA ISSUED', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'description' },
  [RequestStatus.LOA_ACCEPTED]: { label: 'LOA ACCEPTED', color: 'text-green-700', bg: 'bg-green-100', icon: 'handshake' },
  [RequestStatus.COMPLETED]: { label: 'HIRING COMPLETE', color: 'text-emerald-800', bg: 'bg-emerald-200', icon: 'task_alt' },
  // Onboarding Statuses
  [RequestStatus.ONBOARDING_SUBMITTED]: { label: 'ONBOARDING SUBMITTED', color: 'text-cyan-700', bg: 'bg-cyan-100', icon: 'send' },
  [RequestStatus.ONBOARDING_PENDING_HR_APPROVAL]: { label: 'PENDING HR APPROVAL', color: 'text-orange-700', bg: 'bg-orange-100', icon: 'pending' },
  [RequestStatus.ONBOARDING_PRE_ARRIVAL_SETUP]: { label: 'PRE-ARRIVAL SETUP', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: 'settings' },
  [RequestStatus.ONBOARDING_READY_FOR_DAY_1]: { label: 'ORIENTATION', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'school' },
  [RequestStatus.ONBOARDING_DAY_1_ORIENTATION]: { label: 'ORIENTATION', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'school' },
  [RequestStatus.ONBOARDING_WEEK_1_INTEGRATION]: { label: 'INTEGRATION', color: 'text-violet-700', bg: 'bg-violet-100', icon: 'groups' },
  [RequestStatus.ONBOARDING_MONTH_1_MILESTONE]: { label: 'INTEGRATION', color: 'text-violet-700', bg: 'bg-violet-100', icon: 'groups' },
  [RequestStatus.ONBOARDING_MONTH_2_MILESTONE]: { label: 'INTEGRATION', color: 'text-violet-700', bg: 'bg-violet-100', icon: 'groups' },
  [RequestStatus.ONBOARDING_MONTH_3_MILESTONE]: { label: 'INTEGRATION', color: 'text-violet-700', bg: 'bg-violet-100', icon: 'groups' },
  [RequestStatus.ONBOARDING_COMPLETED]: { label: 'ONBOARDING COMPLETE', color: 'text-green-800', bg: 'bg-green-200', icon: 'task_alt' },
  // IT Workflow Statuses

  [RequestStatus.PROCUREMENT_IN_PROGRESS]: { label: 'Procurement In Progress', color: 'text-orange-700', bg: 'bg-orange-100', icon: 'shopping_cart' },
  [RequestStatus.HARDWARE_ORDERED]: { label: 'Hardware Ordered', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'local_shipping' },
  [RequestStatus.HARDWARE_RECEIVED]: { label: 'Hardware Received', color: 'text-teal-700', bg: 'bg-teal-100', icon: 'inventory' },
  [RequestStatus.SOFTWARE_PROVISIONED]: { label: 'Software Provisioned', color: 'text-teal-700', bg: 'bg-teal-100', icon: 'deployed_code' },
  [RequestStatus.ACKNOWLEDGED_IT]: { label: 'Acknowledged', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'check_circle' },
  [RequestStatus.PENDING_CEO_APPROVAL_IT]: { label: 'Pending CEO Approval', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.CEO_APPROVED_IT]: { label: 'CEO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.CEO_REJECTED_IT]: { label: 'CEO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_CTO_APPROVAL_IT]: { label: 'Pending CTO Approval', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.CTO_APPROVED_IT]: { label: 'CTO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.CTO_REJECTED_IT]: { label: 'CTO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_INVOICE_IT]: { label: 'Pending Invoice', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'receipt' },
  [RequestStatus.PENDING_CFO_APPROVAL_IT]: { label: 'Pending CFO Approval', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.CFO_APPROVED_IT]: { label: 'CFO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.CFO_REJECTED_IT]: { label: 'CFO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PAYMENT_PROCESSING_IT]: { label: 'Payment Processing', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'payments' },
  [RequestStatus.PAYMENT_DONE_IT]: { label: 'Payment Done', color: 'text-green-700', bg: 'bg-green-100', icon: 'paid' },
  [RequestStatus.PENDING_DELIVERY_IT]: { label: 'Pending Delivery', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'local_shipping' },
  // Finance Workflow Statuses
  [RequestStatus.PENDING_MANAGER_APPROVAL_FIN]: { label: 'Pending Manager Approval', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'pending' },
  [RequestStatus.MANAGER_APPROVED_FIN]: { label: 'Manager Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.MANAGER_REJECTED_FIN]: { label: 'Manager Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_FINANCE_HEAD_APPROVAL]: { label: 'Pending Finance Head', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: 'pending' },
  [RequestStatus.FINANCE_HEAD_APPROVED]: { label: 'Finance Head Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.FINANCE_HEAD_REJECTED]: { label: 'Finance Head Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PAYMENT_PROCESSING]: { label: 'Payment Processing', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'payments' },
  [RequestStatus.PAYMENT_COMPLETED]: { label: 'Payment Completed', color: 'text-green-700', bg: 'bg-green-100', icon: 'paid' },
  [RequestStatus.REIMBURSEMENT_CLOSED]: { label: 'Reimbursement Closed', color: 'text-gray-700', bg: 'bg-gray-100', icon: 'lock' },
  [RequestStatus.OFFBOARDING_SUBMITTED]: { label: 'Offboarding Submitted', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'logout' },
  [RequestStatus.OFFBOARDING_NOTICE_PERIOD]: { label: 'Notice Period', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: 'schedule' },
  [RequestStatus.OFFBOARDING_KNOWLEDGE_TRANSFER]: { label: 'Knowledge Transfer', color: 'text-orange-700', bg: 'bg-orange-100', icon: 'swap_horiz' },
  [RequestStatus.OFFBOARDING_FINAL_WEEK]: { label: 'Final Week', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'event' },
  [RequestStatus.OFFBOARDING_EXIT_PROCEDURES]: { label: 'Exit Procedures', color: 'text-red-700', bg: 'bg-red-100', icon: 'assignment_return' },
  [RequestStatus.OFFBOARDING_COMPLETED]: { label: 'Offboarding Completed', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  // Finance Purchase Requisition Statuses
  [RequestStatus.FINANCE_PENDING_ACK]: { label: 'Pending Acknowledgement', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.FINANCE_ACKNOWLEDGED]: { label: 'Acknowledged', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'check_circle' },
  [RequestStatus.FINANCE_IN_PROGRESS]: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'sync' },
  [RequestStatus.PENDING_CFO_APPROVAL_FIN]: { label: 'Pending CFO Approval', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'pending' },
  [RequestStatus.CFO_APPROVED_FIN]: { label: 'CFO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.CFO_REJECTED_FIN]: { label: 'CFO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_DCEO_APPROVAL_FIN]: { label: 'Pending DCEO Approval', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'pending' },
  [RequestStatus.DCEO_APPROVED_FIN]: { label: 'DCEO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'verified' },
  [RequestStatus.DCEO_REJECTED_FIN]: { label: 'DCEO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_GROUP_DCEO_APPROVAL]: { label: 'Pending Group Deputy CEO', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'pending' },
  [RequestStatus.GROUP_DCEO_APPROVED]: { label: 'Group Deputy CEO Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'verified' },
  [RequestStatus.GROUP_DCEO_REJECTED]: { label: 'Group Deputy CEO Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PAYMENT_PROCESSING_FIN]: { label: 'Payment Processing', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'payments' },
  [RequestStatus.AWAITING_PAYMENT_CONFIRMATION]: { label: 'Awaiting Confirmation', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'hourglass_empty' },
  [RequestStatus.PAYMENT_CONFIRMED_FIN]: { label: 'Payment Confirmed', color: 'text-green-700', bg: 'bg-green-100', icon: 'paid' },
  [RequestStatus.TICKET_CLOSED_FIN]: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100', icon: 'lock' },
  // Inter-Company Chargeback Statuses
  [RequestStatus.PENDING_FROM_ENTITY_APPROVAL]: { label: 'Pending From-Entity', color: 'text-purple-700', bg: 'bg-purple-100', icon: 'pending' },
  [RequestStatus.FROM_ENTITY_APPROVED]: { label: 'From-Entity Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.FROM_ENTITY_REJECTED]: { label: 'From-Entity Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.PENDING_TO_ENTITY_APPROVAL]: { label: 'Pending To-Entity', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: 'pending' },
  [RequestStatus.TO_ENTITY_APPROVED]: { label: 'To-Entity Approved', color: 'text-green-700', bg: 'bg-green-100', icon: 'check_circle' },
  [RequestStatus.TO_ENTITY_REJECTED]: { label: 'To-Entity Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: 'cancel' },
  [RequestStatus.CHARGEBACK_FINANCE_REVIEW]: { label: 'Finance Review', color: 'text-blue-700', bg: 'bg-blue-100', icon: 'account_balance' },
  [RequestStatus.AWAITING_CHARGEBACK_CONFIRMATION]: { label: 'Awaiting Confirmation', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'hourglass_empty' },
  [RequestStatus.CHARGEBACK_COMPLETED]: { label: 'Chargeback Complete', color: 'text-green-700', bg: 'bg-green-100', icon: 'task_alt' },
};

/**
 * Terminal / closed statuses — requests in these states are treated as
 * "resolved" in list views. Single source of truth; import everywhere instead
 * of re-defining locally (audit finding C5).
 */
export const RESOLVED_STATUSES = new Set<string>([
  RequestStatus.RESOLVED,
  RequestStatus.COMPLETED,
  RequestStatus.REJECTED,
  RequestStatus.CEO_REJECTED,
  RequestStatus.REIMBURSEMENT_CLOSED,
  RequestStatus.ONBOARDING_COMPLETED,
  RequestStatus.OFFBOARDING_COMPLETED,
  RequestStatus.PAYMENT_COMPLETED,
  RequestStatus.LOA_ACCEPTED,
  RequestStatus.CTO_REJECTED_IT,
  RequestStatus.CFO_REJECTED_IT,
  RequestStatus.MANAGER_REJECTED_FIN,
  RequestStatus.FINANCE_HEAD_REJECTED,
  RequestStatus.CFO_REJECTED_FIN,
  RequestStatus.DCEO_REJECTED_FIN,
  RequestStatus.GROUP_DCEO_REJECTED,
  RequestStatus.PAYMENT_CONFIRMED_FIN,
  RequestStatus.TICKET_CLOSED_FIN,
  RequestStatus.FROM_ENTITY_REJECTED,
  RequestStatus.TO_ENTITY_REJECTED,
  RequestStatus.CHARGEBACK_COMPLETED,
]);

/** Array form for APIs that accept a comma-joined excludedStatuses param. */
export const RESOLVED_STATUSES_LIST = [...RESOLVED_STATUSES];

export const MOCK_REQUESTS = [
  {
    id: '1',
    reference: 'IT-4921',
    summary: 'New MacBook Pro M3 Request',
    service: 'IT Support',
    status: RequestStatus.IN_PROGRESS,
    updated: '2 hours ago',
    created: 'Oct 24, 2023',
    type: 'IT',
    description: 'Replacement for aging laptop model 2019.',
    updates: [
      { id: '101', author: 'System', message: 'Ticket created', timestamp: '2 hours ago', isSystem: true }
    ]
  },
  {
    id: '2',
    reference: 'HR-1044',
    summary: 'Annual Leave Request - December',
    service: 'HR Services',
    status: RequestStatus.APPROVED,
    updated: 'Yesterday',
    created: 'Oct 23, 2023',
    type: 'HR',
    updates: []
  },
  {
    id: '3',
    reference: 'FIN-882',
    summary: 'Travel Expense Reimbursement',
    service: 'Group Finance',
    status: RequestStatus.WAITING,
    updated: 'Oct 24, 2023',
    created: 'Oct 22, 2023',
    type: 'FINANCE',
    updates: []
  },
  {
    id: '4',
    reference: 'HR-INC-502',
    summary: 'Discrepancy in Q3 performance review documentation',
    service: 'HR Services',
    status: RequestStatus.IN_REVIEW,
    updated: 'Yesterday, 4:12 PM',
    created: 'Oct 24, 2023',
    type: 'HR',
    description: 'Reporting a potential administrative error in official Q3 performance review records. The feedback uploaded does not align with verbal discussion on Oct 14th.',
    updates: [
      { id: '201', author: 'HR Investigation Team', message: 'Hello, we have received your report regarding the performance review discrepancy. We have initiated a review. Could you please confirm if you have notes?', timestamp: 'Yesterday, 2:45 PM' },
      { id: '202', author: 'Alex Rivera', message: 'Yes, I have my personal notes from that day. I\'ve scanned them and can attach them.', timestamp: 'Yesterday, 4:12 PM' }
    ]
  }
];
