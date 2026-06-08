import { useState, useEffect } from 'react';
import dashboardApi from '../api/dashboard.api';

const FETCHERS = {
  client:   () => dashboardApi.client(),
  attorney: () => dashboardApi.attorney(),
  partner:  () => dashboardApi.partner(),
};

export function useDashboard(role) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const fetch = FETCHERS[role];
    if (!fetch) return;

    setLoading(true);
    setError(null);
    fetch()
      .then(({ data }) => setData(data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [role]);

  return { data, loading, error };
}