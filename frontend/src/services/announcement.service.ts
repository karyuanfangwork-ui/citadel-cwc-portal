import api from './api';

export type AnnouncementCategory = 'HR' | 'MARKETING' | 'IT' | 'GENERAL' | 'FINANCE' | 'POLICY';
export type AnnouncementPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TargetAudience = 'ALL' | 'IT_ONLY' | 'HR_ONLY' | 'FINANCE_ONLY' | 'MANAGEMENT';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  targetAudience: string | null;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  attachmentUrl: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author?: { id: string; firstName: string; lastName: string; email?: string };
  isRead?: boolean;
  _count?: { reads: number };
  reads?: { id: string }[];
}

export interface DashboardAnnouncement {
  id: string;
  title: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  isPinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  author?: { firstName: string; lastName: string };
  isRead?: boolean;
}

export interface DashboardData {
  pinned: DashboardAnnouncement[];
  latest: DashboardAnnouncement[];
}

export interface PaginatedAnnouncements {
  announcements: Announcement[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ParseDocResult {
  text: string;
  filename: string;
  s3Key: string;
  warning: string | null;
}

const announcementService = {
  // ── User-facing ──

  async getDashboard(): Promise<DashboardData> {
    const res = await api.get('/announcements/dashboard');
    return res.data?.data ?? res.data;
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get('/announcements/unread-count');
    return res.data?.data?.count ?? 0;
  },

  async list(params?: {
    page?: number;
    limit?: number;
    category?: AnnouncementCategory;
    priority?: AnnouncementPriority;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PaginatedAnnouncements> {
    const res = await api.get('/announcements', { params });
    return res.data?.data ?? res.data;
  },

  async getOne(id: string): Promise<Announcement> {
    const res = await api.get(`/announcements/${id}`);
    return res.data?.data?.announcement ?? res.data?.data ?? res.data;
  },

  async markRead(id: string): Promise<void> {
    await api.post(`/announcements/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.post('/announcements/mark-all-read');
  },

  // ── Admin ──

  async adminList(params?: {
    page?: number;
    limit?: number;
    category?: AnnouncementCategory;
    priority?: AnnouncementPriority;
    isPublished?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PaginatedAnnouncements> {
    const res = await api.get('/announcements/admin/all', { params });
    return res.data?.data ?? res.data;
  },

  async create(data: {
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
  }): Promise<Announcement> {
    const res = await api.post('/announcements', data);
    return res.data?.data?.announcement ?? res.data?.data ?? res.data;
  },

  async update(id: string, data: {
    title?: string;
    content?: string;
    category?: AnnouncementCategory;
    priority?: AnnouncementPriority;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
  }): Promise<Announcement> {
    const res = await api.patch(`/announcements/${id}`, data);
    return res.data?.data?.announcement ?? res.data?.data ?? res.data;
  },

  async publish(id: string): Promise<Announcement> {
    const res = await api.patch(`/announcements/${id}/publish`);
    return res.data?.data?.announcement ?? res.data?.data ?? res.data;
  },

  async togglePin(id: string, isPinned: boolean): Promise<Announcement> {
    const res = await api.patch(`/announcements/${id}/pin`, { isPinned });
    return res.data?.data?.announcement ?? res.data?.data ?? res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/announcements/${id}`);
  },

  async restore(id: string): Promise<Announcement> {
    const res = await api.patch(`/announcements/${id}/restore`);
    return res.data?.data?.announcement ?? res.data?.data ?? res.data;
  },

  async trashList(params?: { page?: number; limit?: number }): Promise<PaginatedAnnouncements> {
    const res = await api.get('/announcements/admin/trash', { params });
    return res.data?.data ?? res.data;
  },

  async parseDocument(file: File): Promise<ParseDocResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/announcements/parse-doc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.data ?? res.data;
  },

  async uploadImage(file: File): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/announcements/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.data ?? res.data;
  },
};

export default announcementService;