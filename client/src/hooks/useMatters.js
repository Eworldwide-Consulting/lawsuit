import { useState, useEffect, useCallback } from 'react';
import mattersApi from '../api/matters.api';

export function useMatters() {
  const [matters, setMatters]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await mattersApi.list();
      setMatters(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load matters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { matters, loading, error, reload: load };
}

export function useMatter(id) {
  const [matter, setMatter]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    mattersApi.get(id)
      .then(({ data }) => setMatter(data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load matter'))
      .finally(() => setLoading(false));
  }, [id]);

  return { matter, loading, error };
}