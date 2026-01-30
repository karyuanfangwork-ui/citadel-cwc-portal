
export enum RequestStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RESOLVED = 'RESOLVED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  PENDING_CEO_APPROVAL = 'PENDING_CEO_APPROVAL',
  CEO_APPROVED = 'CEO_APPROVED',
  CEO_REJECTED = 'CEO_REJECTED',
  JOB_POSTED = 'JOB_POSTED',
  PENDING_MANAGER_REVIEW = 'PENDING_MANAGER_REVIEW',
  MANAGER_APPROVED = 'MANAGER_APPROVED'
}

export enum RequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface RequestItem {
  id: string;
  reference: string;
  summary: string;
  service: string;
  status: RequestStatus;
  updated: string;
  created: string;
  type: 'IT' | 'HR' | 'FINANCE';
  description?: string;
  stakeholders?: string[];
  updates: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  author: string;
  authorRole?: string;
  avatar?: string;
  timestamp: string;
  message: string;
  isSystem?: boolean;
}

export interface ServiceCard {
  title: string;
  description: string;
  icon: string;
  colorClass: string;
  link: string;
  actionText: string;
}
