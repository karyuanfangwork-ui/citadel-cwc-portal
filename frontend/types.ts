
export enum RequestStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RESOLVED = 'RESOLVED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING'
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
