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
    // Backend returns { status, data: { notifications, pagination } }
    // Axios wraps in response.data, so the shape is response.data.data.notifications
    const wrapper = response.data;
    return {
      data: wrapper.data.notifications,
      pagination: wrapper.data.pagination,
    };
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data.data.count;
  },

  async replayAfter(cursor: string | null): Promise<{ notifications: Notification[]; cursor: string | null }> {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const response = await api.get(`/notifications/replay${params}`);
    return {
      notifications: response.data.data.notifications,
      cursor: response.data.data.cursor,
    };
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
