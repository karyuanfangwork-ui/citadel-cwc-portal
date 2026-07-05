import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Notification } from '../services/notification.service';
import notificationService from '../services/notification.service';
import { useAuth } from './AuthContext';

interface Toast {
  id: string;
  subject: string;
  body: string;
  relatedRequestId: string | null;
}

export interface CrmUpdateEvent {
  type: string;
  entityType: 'lead' | 'opportunity' | 'activity' | 'note' | 'account' | 'contact' | 'duplicate';
  id: string;
  changedBy: string;
}

interface NotificationContextType {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  recentNotification: Notification | null;
  toast: Toast | null;
  dismissToast: () => void;
  lastCrmEvent: CrmUpdateEvent | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api/v1';
const SSE_URL = `${API_BASE}/notifications/stream`;

export const NotificationProvider: React.FC<{ userId: string | null; children: ReactNode }> = ({ userId, children }) => {
  const { accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotification, setRecentNotification] = useState<Notification | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastCrmEvent, setLastCrmEvent] = useState<CrmUpdateEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial unread count
  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    notificationService.getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, [userId]);

  const showToast = useCallback((subject: string, body: string, relatedRequestId?: string | null, notificationId?: string) => {
    const id = notificationId || Math.random().toString(36).slice(2);
    setToast({ id, subject, body, relatedRequestId: relatedRequestId ?? null });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Open/close SSE stream based on auth state
  // P1-02: Use cookie-based auth (withCredentials) instead of ?token= query param
  // to avoid logging JWTs in server access logs and browser history.
  useEffect(() => {
    if (!userId || !accessToken) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    const es = new EventSource(SSE_URL, { withCredentials: true });
    esRef.current = es;

    es.addEventListener('notification', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as Notification;
      setUnreadCount((prev) => prev + 1);
      setRecentNotification(data);
      showToast(data.subject ?? 'New notification', data.body, data.relatedRequestId, data.id);
    });

    es.addEventListener('crm_update', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as CrmUpdateEvent;
      setLastCrmEvent(data);
    });

    es.onerror = () => {
      // Browser auto-reconnects on error; nothing to do here
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [userId, accessToken, showToast]);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount, recentNotification, toast, dismissToast, lastCrmEvent }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};