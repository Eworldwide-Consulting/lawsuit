import { useState, useEffect, useCallback } from 'react';
import notificationsApi from '../api/notifications.api';

/**
 * useNotifications — fetches and manages the notification list.
 *
 * Pass the active socket instance so real-time pushes update the list
 * without a full refetch.
 *
 * Returns:
 *   notifications  Notification[]
 *   unreadCount    number
 *   loading        bool
 *   markRead       (id: number) => void
 *   markAllRead    () => void
 *   reload         () => void
 */
export function useNotifications({ socket } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await notificationsApi.list({ limit: 50, offset: 0 });
      setNotifications(data.items ?? []);
      setUnreadCount(data.unread ?? 0);
    } catch {
      // silent — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time push — prepend without refetch
  useEffect(() => {
    if (!socket) return;
    const onNew = (notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnreadCount(n => n + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket]);

  const markRead = useCallback(async (id) => {
    try {
      await notificationsApi.markRead(id);
      const now = new Date().toISOString();
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: now } : n)
      );
      setUnreadCount(n => Math.max(0, n - 1));
    } catch { /* silent */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, reload: load };
}