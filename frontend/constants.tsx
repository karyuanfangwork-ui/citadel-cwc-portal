
import React from 'react';
import { RequestStatus } from './types';

export const STATUS_CONFIG: Record<RequestStatus, { label: string, color: string, bg: string }> = {
  [RequestStatus.SUBMITTED]: { label: 'SUBMITTED', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.IN_REVIEW]: { label: 'IN REVIEW', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  [RequestStatus.ACTION_REQUIRED]: { label: 'ACTION REQUIRED', color: 'text-orange-700', bg: 'bg-orange-100' },
  [RequestStatus.APPROVED]: { label: 'APPROVED', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  [RequestStatus.REJECTED]: { label: 'REJECTED', color: 'text-red-700', bg: 'bg-red-100' },
  [RequestStatus.RESOLVED]: { label: 'RESOLVED', color: 'text-gray-700', bg: 'bg-gray-100' },
  [RequestStatus.IN_PROGRESS]: { label: 'IN PROGRESS', color: 'text-blue-700', bg: 'bg-blue-100' },
  [RequestStatus.WAITING]: { label: 'WAITING', color: 'text-gray-600', bg: 'bg-gray-100' },
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
