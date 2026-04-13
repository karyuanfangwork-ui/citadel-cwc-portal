
import React from 'react';
import { RequestStatus } from './types';

export const STATUS_CONFIG: Record<RequestStatus, { label: string, color: string, bg: string }> = {
  [RequestStatus.SUBMITTED]: { label: 'SUBMITTED', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.IN_REVIEW]: { label: 'IN REVIEW', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  [RequestStatus.ACTION_REQUIRED]: { label: 'ACTION REQUIRED', color: 'text-orange-700', bg: 'bg-orange-100' },
  [RequestStatus.APPROVED]: { label: 'APPROVED', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  [RequestStatus.REJECTED]: { label: 'REJECTED', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.RESOLVED]: { label: 'COMPLETED', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  [RequestStatus.IN_PROGRESS]: { label: 'IN PROGRESS', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.WAITING]: { label: 'WAITING', color: 'text-gray-600', bg: 'bg-gray-100' },
  [RequestStatus.PENDING_CEO_APPROVAL]: { label: 'PENDING CEO APPROVAL', color: 'text-purple-700', bg: 'bg-purple-100' },
  [RequestStatus.CEO_APPROVED]: { label: 'CEO APPROVED', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.CEO_REJECTED]: { label: 'CEO REJECTED', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.JOB_POSTED]: { label: 'JOB POSTED', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.PENDING_MANAGER_REVIEW]: { label: 'PENDING MANAGER REVIEW', color: 'text-orange-700', bg: 'bg-orange-100' },
  [RequestStatus.MANAGER_APPROVED]: { label: 'MANAGER APPROVED', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.INTERVIEW_SCHEDULED]: { label: 'INTERVIEW SCHEDULED', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  [RequestStatus.INTERVIEW_FEEDBACK_PENDING]: { label: 'FEEDBACK RECEIVED', color: 'text-orange-700', bg: 'bg-orange-100' },
  [RequestStatus.CANDIDATE_REJECTED_INTERVIEW]: { label: 'CANDIDATE REJECTED', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.HR_SCREENING]: { label: 'HR SCREENING', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.LOA_PENDING_APPROVAL]: { label: 'LOA APPROVAL', color: 'text-orange-700', bg: 'bg-orange-100' },
  [RequestStatus.LOA_APPROVED]: { label: 'LOA APPROVED', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  [RequestStatus.LOA_ISSUED]: { label: 'LOA ISSUED', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.LOA_ACCEPTED]: { label: 'LOA ACCEPTED', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.COMPLETED]: { label: 'HIRING COMPLETE', color: 'text-emerald-800', bg: 'bg-emerald-200' },
  // Onboarding Statuses
  [RequestStatus.ONBOARDING_SUBMITTED]: { label: 'ONBOARDING SUBMITTED', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  [RequestStatus.ONBOARDING_PENDING_HR_APPROVAL]: { label: 'PENDING HR APPROVAL', color: 'text-orange-700', bg: 'bg-orange-100' },
  [RequestStatus.ONBOARDING_PRE_ARRIVAL_SETUP]: { label: 'PRE-ARRIVAL SETUP', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  [RequestStatus.ONBOARDING_READY_FOR_DAY_1]: { label: 'READY FOR DAY 1', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.ONBOARDING_DAY_1_ORIENTATION]: { label: 'DAY 1 ORIENTATION', color: 'text-purple-700', bg: 'bg-purple-100' },
  [RequestStatus.ONBOARDING_WEEK_1_INTEGRATION]: { label: 'WEEK 1 INTEGRATION', color: 'text-violet-700', bg: 'bg-violet-100' },
  [RequestStatus.ONBOARDING_MONTH_1_MILESTONE]: { label: '30-DAY MILESTONE', color: 'text-sky-700', bg: 'bg-sky-100' },
  [RequestStatus.ONBOARDING_MONTH_2_MILESTONE]: { label: '60-DAY MILESTONE', color: 'text-teal-700', bg: 'bg-teal-100' },
  [RequestStatus.ONBOARDING_MONTH_3_MILESTONE]: { label: '90-DAY MILESTONE', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  [RequestStatus.ONBOARDING_COMPLETED]: { label: 'ONBOARDING COMPLETE', color: 'text-green-800', bg: 'bg-green-200' },
  // IT Workflow Statuses
  [RequestStatus.PENDING_MANAGER_APPROVAL_IT]: { label: 'Pending Manager Approval', color: 'text-purple-700', bg: 'bg-purple-100' },
  [RequestStatus.MANAGER_APPROVED_IT]: { label: 'Manager Approved', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.MANAGER_REJECTED_IT]: { label: 'Manager Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.PENDING_VP_APPROVAL_IT]: { label: 'Pending VP Approval', color: 'text-amber-700', bg: 'bg-amber-100' },
  [RequestStatus.VP_APPROVED_IT]: { label: 'VP Approved', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.VP_REJECTED_IT]: { label: 'VP Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.PROCUREMENT_IN_PROGRESS]: { label: 'Procurement In Progress', color: 'text-orange-700', bg: 'bg-orange-100' },
  [RequestStatus.HARDWARE_ORDERED]: { label: 'Hardware Ordered', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.HARDWARE_RECEIVED]: { label: 'Hardware Received', color: 'text-teal-700', bg: 'bg-teal-100' },
  [RequestStatus.SOFTWARE_PROVISIONED]: { label: 'Software Provisioned', color: 'text-teal-700', bg: 'bg-teal-100' },
  // Finance Workflow Statuses
  [RequestStatus.PENDING_MANAGER_APPROVAL_FIN]: { label: 'Pending Manager Approval', color: 'text-purple-700', bg: 'bg-purple-100' },
  [RequestStatus.MANAGER_APPROVED_FIN]: { label: 'Manager Approved', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.MANAGER_REJECTED_FIN]: { label: 'Manager Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.PENDING_FINANCE_HEAD_APPROVAL]: { label: 'Pending Finance Head', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  [RequestStatus.FINANCE_HEAD_APPROVED]: { label: 'Finance Head Approved', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.FINANCE_HEAD_REJECTED]: { label: 'Finance Head Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.PAYMENT_PROCESSING]: { label: 'Payment Processing', color: 'text-amber-700', bg: 'bg-amber-100' },
  [RequestStatus.PAYMENT_COMPLETED]: { label: 'Payment Completed', color: 'text-green-700', bg: 'bg-green-100' },
  [RequestStatus.REIMBURSEMENT_CLOSED]: { label: 'Reimbursement Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

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
