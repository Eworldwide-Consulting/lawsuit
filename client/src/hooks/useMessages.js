import { useState, useEffect, useCallback } from 'react';
import messagesApi from '../api/messages.api';

export function useMessages(view = 'inbox') {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await (view === 'sent' ? messagesApi.sent() : messagesApi.inbox());
      setMessages(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => { load(); }, [load]);

  return { messages, loading, error, reload: load };
}

export function useUnreadCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await messagesApi.unreadCount();
      setCount(data.count ?? 0);
    } catch {
      // non-critical — leave prior count intact
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { count, refresh };
}