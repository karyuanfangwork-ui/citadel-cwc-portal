import api from './api';

export interface Notification {
  id: string;
  subject: string | null;
  body: string;
  channel: string;
  status: string;
  readAt: string | null;
  relatedRequestId: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

const notificationService = {
  async getNotifications(page = 1, limit = 10): Promise<NotificationsResponse> {
    const response = await api.get(`/notifications?page=${page}&limit=${limit}`);
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data.data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};

export default notificationService;
